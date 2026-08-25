import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/member/test/member-consent.e2e-spec.ts (T3.3)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T3.4: ประวัติ (MemberConsent) ย้ายไม่หาย, ย้อนกลับได้ผ่าน audit log, รายการรองถูก
 * ปิดใช้งาน+ทำเครื่องหมาย mergedIntoId — ยอด "คอร์สคงเหลือ" ยังทดสอบไม่ได้ (ยังไม่มี MemberPackage
 * ในระบบ ดู docs/decisions.md ADR-018)
 */
describe("Member merge (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let managerACookies: string[];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    process.env.DATABASE_URL = databaseUrl;
    process.env.APP_DATABASE_URL = databaseUrl;
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.SMTP_HOST ??= "localhost";
    process.env.SMTP_PORT ??= "1025";
    process.env.JWT_ACCESS_SECRET ??= "e2e-test-access-secret-at-least-32-chars";
    process.env.JWT_REFRESH_SECRET ??= "e2e-test-refresh-secret-at-least-32-chars";
    process.env.NODE_ENV = "test";

    execSync("npx prisma migrate deploy", {
      cwd: "../../packages/db",
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });

    const db = await import("@lotus-desk/db");
    const prisma = db.prisma;
    const argon2 = await import("argon2");

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "MERGE-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "MERGE-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "member:view", description: "ดูข้อมูลสมาชิก" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "member:manage", description: "จัดการสมาชิก" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-merge-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({
      data: { userId: manager.id, branchId: branchAId, roleId: managerRole.id },
    });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: managerEmail, password: managerPassword });
    managerACookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  async function createMember(name: string, phone: string, branchId = branchAId) {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/members`)
      .set("Cookie", managerACookies)
      .send({ name, phone });
    return res.body.id as string;
  }

  /** สร้างสมาชิก "รายการรอง" สำหรับทดสอบ merge — เบอร์ซ้ำกับ primary เสมอ ต้องยืนยัน confirmDuplicate */
  async function createDuplicateMember(name: string, phone: string) {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name, phone, confirmDuplicate: true });
    return res.body.id as string;
  }

  it("moves consent history from the secondary to the primary member and deactivates the secondary", async () => {
    const primaryId = await createMember("หลัก คนจริง", "0811111111");
    const secondaryId = await createDuplicateMember("รอง บันทึกซ้ำ", "0811111111");

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${secondaryId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" });

    const mergeRes = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${secondaryId}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: primaryId });

    expect(mergeRes.status).toBe(201);
    expect(mergeRes.body.isActive).toBe(false);
    expect(mergeRes.body.mergedIntoId).toBe(primaryId);

    // ประวัติต้องย้ายไปหาสมาชิกหลัก ไม่หายไปไหน
    const primaryConsents = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members/${primaryId}/consents`)
      .set("Cookie", managerACookies);
    expect(primaryConsents.body).toHaveLength(1);
    expect(primaryConsents.body[0].status).toBe("GRANTED");

    const secondaryConsents = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members/${secondaryId}/consents`)
      .set("Cookie", managerACookies);
    expect(secondaryConsents.body).toHaveLength(0);
  });

  it("is reconstructible via audit log: before/after captured for both the member and each moved consent", async () => {
    const primaryId = await createMember("หลัก สอง", "0822222222");
    const secondaryId = await createDuplicateMember("รอง สอง", "0822222222");

    const consent = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${secondaryId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "HEALTH_DATA", status: "GRANTED", channel: "PHONE", textVersion: "v1" });
    const consentId = consent.body.id as string;

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${secondaryId}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: primaryId });

    const db = await import("@lotus-desk/db");
    // AuditInterceptor แปะ action จาก HTTP method เสมอ (POST -> CREATE) ไม่ได้แปลตามความหมายจริงของ
    // การเปลี่ยนแปลง — /merge เป็น POST (แพทเทิร์นเดียวกับ /consents) จึงได้ action "CREATE" แม้จะเป็นการ
    // แก้ไขสมาชิกจริง ๆ ก็ตาม (ดู docs/decisions.md ADR-018) — before/after ยังครบ ย้อนกลับได้ปกติ
    const memberAudit = await db.prisma.auditLog.findFirst({
      where: { entity: "Member", entityId: secondaryId, action: "CREATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(memberAudit).not.toBeNull();
    expect((memberAudit!.before as Record<string, unknown>).isActive).toBe(true);
    expect((memberAudit!.after as Record<string, unknown>).isActive).toBe(false);
    expect((memberAudit!.after as Record<string, unknown>).mergedIntoId).toBe(primaryId);

    const consentAudit = await db.prisma.auditLog.findFirst({
      where: { entity: "MemberConsent", entityId: consentId, action: "UPDATE" },
    });
    expect(consentAudit).not.toBeNull();
    expect((consentAudit!.before as Record<string, unknown>).memberId).toBe(secondaryId);
    expect((consentAudit!.after as Record<string, unknown>).memberId).toBe(primaryId);
  });

  it("rejects merging a member into itself", async () => {
    const memberId = await createMember("เดี่ยว", "0833333333");
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: memberId });
    expect(res.status).toBe(422);
  });

  it("rejects merging a member that has already been merged", async () => {
    const primaryId = await createMember("หลัก สาม", "0844444444");
    const secondary = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "รอง สาม", phone: "0844444444", confirmDuplicate: true });
    const secondaryId = secondary.body.id as string;

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${secondaryId}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: primaryId });

    const anotherPrimaryId = await createMember("หลัก สี่", "0855555555");
    const secondMerge = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${secondaryId}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: anotherPrimaryId });
    expect(secondMerge.status).toBe(409);
  });

  it("rejects merging into a member that was itself already merged away", async () => {
    const grandPrimaryId = await createMember("ต้นตอ", "0866666666");
    const middleMember = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "กลาง", phone: "0866666666", confirmDuplicate: true });
    const middleId = middleMember.body.id as string;
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${middleId}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: grandPrimaryId });

    const newMember = await createMember("ใหม่", "0877777777");
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${newMember}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: middleId });
    expect(res.status).toBe(422);
  });

  it("rejects the manager of branch A from merging members outside their branch (404)", async () => {
    // managerA ไม่สังกัดสาขา B เลย — สร้างสมาชิกสาขา B ตรงผ่าน Prisma แทนผ่าน API (ถ้าสร้างผ่าน API ด้วย
    // managerACookies จะโดน PermissionGuard บล็อก 403 ตั้งแต่ก่อนสร้าง ไม่ใช่สิ่งที่ทดสอบนี้ต้องการเช็ค)
    const db = await import("@lotus-desk/db");
    const outside = await db.prisma.member.create({
      data: { branchId: branchBId, code: "M900001", name: "นอกสาขา", phone: "0888888888" },
    });
    const somePrimaryId = await createMember("หลัก นอกสาขา", "0899999999");

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${outside.id}/merge`)
      .set("Cookie", managerACookies)
      .send({ primaryMemberId: somePrimaryId });
    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/anything/merge`)
      .send({ primaryMemberId: "anything-else" });
    expect(res.status).toBe(401);
  });
});

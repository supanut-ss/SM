import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/member/test/member.e2e-spec.ts (T3.1)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านหลักของ T3.3: "ถอนความยินยอมรับข่าวสารแล้ว ต้องหลุดจากรายชื่อส่งโปรฯ ทันที" รวม append-only
 * history (ไม่มี PATCH/DELETE), สถานะปัจจุบัน = แถวล่าสุด, branch scoping
 */
describe("Member consents (real Postgres via Testcontainers)", () => {
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "CONSENT-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "CONSENT-B" } });
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

    const managerEmail = "manager-consent-a@lotusdesk.local";
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

  async function createMember(name: string, phone: string) {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name, phone });
    return res.body.id as string;
  }

  it("records a consent grant and lists it in history", async () => {
    const memberId = await createMember("ยินยอมข่าวสาร", "0811111111");

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("GRANTED");

    const history = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
  });

  it("appends a new row on withdrawal rather than modifying the old one (append-only)", async () => {
    const memberId = await createMember("ถอนความยินยอมภายหลัง", "0822222222");

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" });

    const withdraw = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "WITHDRAWN", channel: "PHONE", textVersion: "v1" });
    expect(withdraw.status).toBe(201);

    const history = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies);
    expect(history.body).toHaveLength(2);
    // ล่าสุดต้องมาก่อน (orderBy createdAt desc)
    expect(history.body[0].status).toBe("WITHDRAWN");
    expect(history.body[1].status).toBe("GRANTED");
  });

  it("drops a member from the marketing list immediately after withdrawal (T3.3 pass criteria)", async () => {
    const memberId = await createMember("ทดสอบเกณฑ์ผ่านหลัก", "0833333333");

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" });

    const beforeWithdraw = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?marketingConsent=true`)
      .set("Cookie", managerACookies);
    expect((beforeWithdraw.body as Array<{ id: string }>).map((m) => m.id)).toContain(memberId);

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "WITHDRAWN", channel: "IN_PERSON", textVersion: "v1" });

    const afterWithdraw = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?marketingConsent=true`)
      .set("Cookie", managerACookies);
    expect((afterWithdraw.body as Array<{ id: string }>).map((m) => m.id)).not.toContain(memberId);

    const excludedList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?marketingConsent=false`)
      .set("Cookie", managerACookies);
    expect((excludedList.body as Array<{ id: string }>).map((m) => m.id)).toContain(memberId);
  });

  it("never includes a member who has never given marketing consent in the granted list", async () => {
    const memberId = await createMember("ไม่เคยยินยอมเลย", "0844444444");

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?marketingConsent=true`)
      .set("Cookie", managerACookies);
    expect((list.body as Array<{ id: string }>).map((m) => m.id)).not.toContain(memberId);
  });

  it("rejects recording consent for a member that belongs to a different branch", async () => {
    const outsideMember = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/does-not-exist-in-branch-b/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MARKETING", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" });
    expect(outsideMember.status).toBe(404);
  });

  it("rejects an invalid consent type/channel (validation)", async () => {
    const memberId = await createMember("ตรวจ validation", "0855555555");

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberId}/consents`)
      .set("Cookie", managerACookies)
      .send({ type: "MAGIC", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" });
    expect(res.status).toBe(400);
  });

  it("rejects the manager of branch A from reading/writing consents of branch B with 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/members/anything/consents`)
      .set("Cookie", managerACookies);
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const memberId = await createMember("เช็ค 401", "0866666666");
    const res = await request(app.getHttpServer()).get(
      `/branches/${branchAId}/members/${memberId}/consents`,
    );
    expect(res.status).toBe(401);
  });
});

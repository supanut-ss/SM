import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/service/test/service.e2e-spec.ts (T2.3)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T3.1: รหัสสมาชิกรันอัตโนมัติ, ค้นหาแบบพิมพ์ไม่ครบก็เจอ, เตือนซ้ำตอนสร้างถ้าเบอร์ตรงกัน
 * (409 → ยืนยันด้วย confirmDuplicate:true แล้วสร้างต่อได้) รวม branch scoping
 *
 * หมายเหตุ: การวัด "ค้นหา 10,000 รายการ < 100ms" จริงยังไม่ได้ทำในเซสชันนี้ (Docker ใช้ไม่ได้ตอนพัฒนา —
 * ดู docs/decisions.md ADR-014) ต้องวัดแยกเมื่อมี Postgres จริงที่มี GIN trigram index ใช้งานได้
 */
describe("Members (real Postgres via Testcontainers)", () => {
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "MEMBER-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "MEMBER-B" } });
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

    const managerEmail = "manager-member-a@lotusdesk.local";
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

  it("creates a member and auto-generates a sequential code", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "สมหญิง ใจดี", phone: "0812345678" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("สมหญิง ใจดี");
    expect(res.body.code).toMatch(/^M\d{6}$/);
    expect(res.body.branchId).toBe(branchAId);
  });

  it("rejects an invalid phone number (validation)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "เบอร์พัง", phone: "123" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "phone" })]),
    );
  });

  it("warns (409) when creating a member with a phone that already exists, listing the duplicate", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "สมหญิง คนที่สอง", phone: "0812345678" });

    expect(res.status).toBe(409);
    expect(res.body.duplicates).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "สมหญิง ใจดี" })]),
    );
  });

  it("creates the duplicate-phone member anyway once confirmDuplicate is set (warn, not block)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "สมหญิง คนที่สอง", phone: "0812345678", confirmDuplicate: true });

    expect(res.status).toBe(201);
    expect(res.body.phone).toBe("0812345678");
  });

  it("finds a member by a partial name match (ค้นหาแบบพิมพ์ไม่ครบก็เจอ)", async () => {
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "วิภาวรรณ เก่งมาก", phone: "0899999999" });

    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?q=${encodeURIComponent("ภาวรรณ")}`)
      .set("Cookie", managerACookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("วิภาวรรณ เก่งมาก");
  });

  it("finds a member by a partial phone match", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?q=${encodeURIComponent("99999")}`)
      .set("Cookie", managerACookies);

    expect(res.status).toBe(200);
    expect((res.body as Array<{ phone: string }>).some((m) => m.phone === "0899999999")).toBe(true);
  });

  it("updates a member's fields without touching the code", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "แก้ไขได้", phone: "0888888888" });
    const memberId = created.body.id as string;
    const originalCode = created.body.code as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/members/${memberId}`)
      .set("Cookie", managerACookies)
      .send({ note: "ลูกค้าประจำ" });

    expect(updated.status).toBe(200);
    expect(updated.body.note).toBe("ลูกค้าประจำ");
    expect(updated.body.code).toBe(originalCode);
  });

  it("deactivates a member and hides it from the default (active-only) list", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "ปิดใช้งานได้", phone: "0877777777" });
    const memberId = created.body.id as string;

    const deactivated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/members/${memberId}`)
      .set("Cookie", managerACookies)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);

    const defaultList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members`)
      .set("Cookie", managerACookies);
    expect((defaultList.body as Array<{ id: string }>).map((m) => m.id)).not.toContain(memberId);

    const allList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/members?isActive=all`)
      .set("Cookie", managerACookies);
    expect((allList.body as Array<{ id: string }>).map((m) => m.id)).toContain(memberId);
  });

  it("rejects the manager of branch A from reading/creating members of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/members`)
      .set("Cookie", managerACookies);
    expect(list.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/members`)
      .set("Cookie", managerACookies)
      .send({ name: "ไม่ควรสร้างได้", phone: "0866666666" });
    expect(create.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/members`);
    expect(res.status).toBe(401);
  });
});

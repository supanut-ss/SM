import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/rbac/test/rbac.e2e-spec.ts
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * เกณฑ์ผ่านของ T2.1: "สร้าง/แก้/ปิดใช้งานได้ ค้นหาได้" — ครอบทุกเส้นทางรวม branch scoping (T1.4)
 * และ validation ที่พัง (เบอร์ผิดรูปแบบ, ไม่เลือกทักษะเลย)
 */
describe("Staff (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let managerACookies: string[];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    process.env.DATABASE_URL = databaseUrl;
    // ต้องตั้งด้วย ไม่ใช่แค่ DATABASE_URL — @lotus-desk/db เลือก APP_DATABASE_URL ก่อนเสมอถ้ามีค่า
    // (ดู packages/db/src/index.ts) ถ้าเครื่อง dev มี .env จริงที่ตั้ง APP_DATABASE_URL ไว้แล้ว (ชี้ไป
    // DB dev ปกติ) ค่านั้นจะ "ชนะ" DATABASE_URL ของ container ทดสอบนี้เงียบ ๆ ทำให้ test ไปพัง DB dev
    // จริงแทน (ดู docs/decisions.md ADR-009)
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "STAFF-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "STAFF-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "staff:view", description: "ดูข้อมูลพนักงาน" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "staff:manage", description: "จัดการพนักงาน" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-staff-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    // manager สังกัดแค่สาขา A เท่านั้น — ไม่มี UserBranch ที่สาขา B เลย (ทดสอบ branch scoping)
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

  it("creates a staff profile with level + skills under the manager's own branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณสมชาย", phone: "0812345678", level: "SENIOR", skills: ["THAI_MASSAGE", "OIL"] });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("คุณสมชาย");
    expect(res.body.level).toBe("SENIOR");
    expect(res.body.skills).toEqual(["THAI_MASSAGE", "OIL"]);
    expect(res.body.isActive).toBe(true);
    expect(res.body.branchId).toBe(branchAId);
  });

  it("rejects creation with no skills selected (validation)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณไม่มีทักษะ", level: "JUNIOR", skills: [] });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "skills" })]),
    );
  });

  it("rejects creation with a malformed phone number (validation)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณเบอร์ผิด", phone: "123", level: "JUNIOR", skills: ["NAIL"] });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "phone" })]),
    );
  });

  it("lists only active staff by default, sorted by name, and supports search by name/phone", async () => {
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณอารีย์", phone: "0898765432", level: "MASTER", skills: ["FACIAL"] });

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies);

    expect(list.status).toBe(200);
    const names = (list.body as Array<{ name: string }>).map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("คุณสมชาย");
    expect(names).toContain("คุณอารีย์");

    const searchByName = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/staff?q=${encodeURIComponent("อารีย์")}`)
      .set("Cookie", managerACookies);
    expect(searchByName.body).toHaveLength(1);
    expect(searchByName.body[0].name).toBe("คุณอารีย์");

    const searchByPhone = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/staff?q=0898765432`)
      .set("Cookie", managerACookies);
    expect(searchByPhone.body).toHaveLength(1);
    expect(searchByPhone.body[0].name).toBe("คุณอารีย์");
  });

  it("updates a staff profile's fields (edit)", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณแก้ไข", level: "JUNIOR", skills: ["NAIL"] });
    const staffId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/staff/${staffId}`)
      .set("Cookie", managerACookies)
      .send({ level: "SENIOR", skills: ["NAIL", "FACIAL"] });

    expect(updated.status).toBe(200);
    expect(updated.body.level).toBe("SENIOR");
    expect(updated.body.skills).toEqual(["NAIL", "FACIAL"]);
  });

  it("deactivates a staff profile and hides it from the default (active-only) list", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณปิดใช้งาน", level: "JUNIOR", skills: ["NAIL"] });
    const staffId = created.body.id as string;

    const deactivated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/staff/${staffId}`)
      .set("Cookie", managerACookies)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    const defaultList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies);
    expect((defaultList.body as Array<{ id: string }>).map((s) => s.id)).not.toContain(staffId);

    const allList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/staff?isActive=all`)
      .set("Cookie", managerACookies);
    expect((allList.body as Array<{ id: string }>).map((s) => s.id)).toContain(staffId);
  });

  it("rejects the manager of branch A from listing/creating/reading staff of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/staff`)
      .set("Cookie", managerACookies);
    expect(list.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "ไม่ควรสร้างได้", level: "JUNIOR", skills: ["NAIL"] });
    expect(create.status).toBe(403);
  });

  it("returns 404 (not leaking existence) when a branch-B manager reads a branch-A staff id through branch B's route", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff`)
      .set("Cookie", managerACookies)
      .send({ name: "คุณข้ามสาขา", level: "JUNIOR", skills: ["NAIL"] });
    const staffId = created.body.id as string;

    const db = await import("@lotus-desk/db");
    const prisma = db.prisma;
    const argon2 = await import("argon2");

    const viewPermission = await prisma.permission.findUniqueOrThrow({ where: { key: "staff:view" } });
    const managerBRole = await prisma.role.create({ data: { key: "manager-b", name: "ผู้จัดการ B" } });
    await prisma.rolePermission.create({
      data: { roleId: managerBRole.id, permissionId: viewPermission.id },
    });
    const managerBEmail = "manager-staff-b@lotusdesk.local";
    const managerBPassword = "ChangeMe123!";
    const managerB = await prisma.user.create({
      data: {
        email: managerBEmail,
        name: "ผู้จัดการสาขา B (test)",
        passwordHash: await argon2.hash(managerBPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({
      data: { userId: managerB.id, branchId: branchBId, roleId: managerBRole.id },
    });
    const loginB = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: managerBEmail, password: managerBPassword });
    const managerBCookies = loginB.headers["set-cookie"] as unknown as string[];

    const res = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/staff/${staffId}`)
      .set("Cookie", managerBCookies);

    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/staff`);
    expect(res.status).toBe(401);
  });
});

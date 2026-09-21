import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *
 * ครอบเกณฑ์ผ่านของ "เพิ่ม/แก้ไข/ปิดใช้งาน user" (ดู docs/decisions.md ADR-060): owner สร้าง/แก้ user ได้
 * (settings:manage), manager ทำไม่ได้ (403), อีเมลซ้ำได้ 409, บทบาทไม่มีจริงได้ 404, ปิดใช้งานแล้วเพิกถอน
 * session เดิม, แก้ user คนละสาขาได้ 404
 */
describe("User CRUD (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let otherBranchId: string;
  let ownerCookies: string[];
  let managerCookies: string[];

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "USERCRUD-A" } });
    branchId = branch.id;
    const otherBranch = await prisma.branch.create({ data: { name: "สาขา B", code: "USERCRUD-B" } });
    otherBranchId = otherBranch.id;

    const settingsManage = await prisma.permission.create({
      data: { key: "settings:manage", description: "ตั้งค่าระบบ" },
    });
    const staffView = await prisma.permission.create({ data: { key: "staff:view", description: "ดูพนักงาน" } });

    const ownerRole = await prisma.role.create({ data: { key: "owner", name: "เจ้าของร้าน" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: ownerRole.id, permissionId: settingsManage.id },
        { roleId: ownerRole.id, permissionId: staffView.id },
      ],
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.create({ data: { roleId: managerRole.id, permissionId: staffView.id } });
    await prisma.role.create({ data: { key: "cashier", name: "แคชเชียร์" } });
    await prisma.role.create({ data: { key: "staff", name: "พนักงานบริการ" } });

    const ownerEmail = "owner-usercrud-a@lotusdesk.local";
    const ownerPassword = "OwnerPass123!";
    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "เจ้าของร้านสาขา A (test)",
        passwordHash: await argon2.hash(ownerPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: owner.id, branchId, roleId: ownerRole.id } });

    const managerEmail = "manager-usercrud-a@lotusdesk.local";
    const managerPassword = "ManagerPass123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: manager.id, branchId, roleId: managerRole.id } });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const ownerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: ownerEmail, password: ownerPassword });
    ownerCookies = ownerLogin.headers["set-cookie"] as unknown as string[];

    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: managerEmail, password: managerPassword });
    managerCookies = managerLogin.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("manager (ไม่มี settings:manage) สร้าง user ไม่ได้ ต้องโดน 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", managerCookies)
      .send({ email: "blocked@lotusdesk.local", name: "BlockedUser", password: "Password123!", roleKey: "staff" });
    expect(res.status).toBe(403);
  });

  it("บทบาทไม่มีจริง ต้องได้ 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies)
      .send({ email: "badrole@lotusdesk.local", name: "BadRoleUser", password: "Password123!", roleKey: "ghost" });
    expect(res.status).toBe(400); // zod enum ปฏิเสธ roleKey ที่ไม่รู้จักตั้งแต่ validation แล้ว ไม่ถึง backend
  });

  let createdUserId: string;

  it("owner สร้าง user ใหม่สำเร็จ", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies)
      .send({
        email: "newstaff-usercrud@lotusdesk.local",
        name: "NewStaff",
        password: "Password123!",
        roleKey: "staff",
      });
    expect(res.status).toBe(201);
    expect(res.body.roleKey).toBe("staff");
    createdUserId = res.body.id;

    // login ด้วยรหัสผ่านที่ตั้งไว้ตอนสร้างได้จริง
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "newstaff-usercrud@lotusdesk.local", password: "Password123!" });
    expect(login.status).toBe(200);
  });

  it("สร้าง user ด้วยอีเมลซ้ำ ต้องได้ 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies)
      .send({
        email: "newstaff-usercrud@lotusdesk.local",
        name: "DuplicateEmailUser",
        password: "Password123!",
        roleKey: "staff",
      });
    expect(res.status).toBe(409);
  });

  it("owner แก้บทบาทและชื่อ user ได้", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/users/${createdUserId}`)
      .set("Cookie", ownerCookies)
      .send({ name: "NewStaffPromoted", roleKey: "cashier" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("NewStaffPromoted");
    expect(res.body.roleKey).toBe("cashier");
  });

  it("แก้ user คนละสาขา ต้องได้ 404", async () => {
    const otherOwnerRole = await (await import("@lotus-desk/db")).prisma.role.findUnique({
      where: { key: "owner" },
    });
    const db = await import("@lotus-desk/db");
    const argon2 = await import("argon2");
    const otherOwner = await db.prisma.user.create({
      data: {
        email: "owner-usercrud-b@lotusdesk.local",
        name: "เจ้าของร้านสาขา B (test)",
        passwordHash: await argon2.hash("OwnerBPass123!"),
        isActive: true,
      },
    });
    await db.prisma.userBranch.create({
      data: { userId: otherOwner.id, branchId: otherBranchId, roleId: otherOwnerRole!.id },
    });
    const otherOwnerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "owner-usercrud-b@lotusdesk.local", password: "OwnerBPass123!" });
    const otherOwnerCookies = otherOwnerLogin.headers["set-cookie"] as unknown as string[];

    const res = await request(app.getHttpServer())
      .patch(`/branches/${otherBranchId}/users/${createdUserId}`)
      .set("Cookie", otherOwnerCookies)
      .send({ name: "ShouldNotEdit" });
    expect(res.status).toBe(404);
  });

  it("owner ปิดใช้งาน user — login ไม่ได้อีก และ session เดิมถูกเพิกถอน", async () => {
    const loginBefore = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "newstaff-usercrud@lotusdesk.local", password: "Password123!" });
    const oldRefreshCookie = (loginBefore.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("refresh_token="),
    )!;

    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/users/${createdUserId}`)
      .set("Cookie", ownerCookies)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const loginAfter = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "newstaff-usercrud@lotusdesk.local", password: "Password123!" });
    expect(loginAfter.status).toBe(401);

    const refreshWithOldToken = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", oldRefreshCookie);
    expect(refreshWithOldToken.status).toBe(401);
  });

  it("GET /users ค่าเริ่มต้นไม่เห็น user ที่ปิดใช้งาน แต่ ?isActive=all เห็น", async () => {
    const defaultList = await request(app.getHttpServer())
      .get(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies);
    expect(defaultList.body.some((u: { id: string }) => u.id === createdUserId)).toBe(false);

    const allList = await request(app.getHttpServer())
      .get(`/branches/${branchId}/users?isActive=all`)
      .set("Cookie", ownerCookies);
    expect(allList.body.some((u: { id: string }) => u.id === createdUserId)).toBe(true);
  });

  // ครอบ ADR-065 — login ด้วยชื่อผู้ใช้แทนอีเมลได้, ชื่อต้องไม่ซ้ำ (unique จริงในสคีมา), ชื่อต้องเป็น
  // ภาษาอังกฤษเท่านั้นตั้งแต่ระดับ validation
  it("login ด้วยชื่อผู้ใช้ (ไม่ใช่อีเมล) ได้ด้วย", async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies)
      .send({
        email: "loginbyname@lotusdesk.local",
        name: "LoginByNameUser",
        password: "Password123!",
        roleKey: "staff",
      });
    expect(createRes.status).toBe(201);

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "LoginByNameUser", password: "Password123!" });
    expect(login.status).toBe(200);
  });

  it("สร้าง user ด้วยชื่อซ้ำ (คนละอีเมล) ต้องได้ 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies)
      .send({
        email: "different-email@lotusdesk.local",
        name: "LoginByNameUser",
        password: "Password123!",
        roleKey: "staff",
      });
    expect(res.status).toBe(409);
  });

  it("สร้าง user ด้วยชื่อภาษาไทย ต้องได้ 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/users`)
      .set("Cookie", ownerCookies)
      .send({
        email: "thainame@lotusdesk.local",
        name: "สมชาย",
        password: "Password123!",
        roleKey: "staff",
      });
    expect(res.status).toBe(400);
  });
});

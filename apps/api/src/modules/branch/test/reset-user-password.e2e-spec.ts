import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *
 * ครอบเกณฑ์ผ่านของฟีเจอร์ "เจ้าของร้านรีเซ็ตรหัสผ่าน user คนอื่น" (ดู docs/decisions.md ADR-059):
 * owner ทำได้ (settings:manage), manager ทำไม่ได้ (403), เป้าหมายอยู่คนละสาขาได้ 404, รหัสผ่านสั้นเกินได้
 * 400, หลังรีเซ็ตแล้ว login ด้วยรหัสผ่านเก่าไม่ได้อีก/ใหม่ได้ และ refresh token เดิมถูกเพิกถอน
 */
describe("Reset user password (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let otherBranchId: string;
  let ownerCookies: string[];
  let managerCookies: string[];
  let targetUserId: string;
  let targetOldPassword: string;
  let targetOldRefreshCookie: string;

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "RESETPW-A" } });
    branchId = branch.id;
    const otherBranch = await prisma.branch.create({ data: { name: "สาขา B", code: "RESETPW-B" } });
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

    const ownerEmail = "owner-resetpw-a@lotusdesk.local";
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
    // owner คนเดียวกันสังกัดสาขา B ด้วย (เจ้าของร้านหลายสาขา) — ใช้ทดสอบเส้นทาง 404 จริงของ endpoint เอง
    // (แยกจากกรณี PermissionGuard บล็อกตั้งแต่ต้นเพราะไม่สังกัดสาขานั้นเลย)
    await prisma.userBranch.create({ data: { userId: owner.id, branchId: otherBranchId, roleId: ownerRole.id } });

    const managerEmail = "manager-resetpw-a@lotusdesk.local";
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

    targetOldPassword = "OldPass123!";
    const target = await prisma.user.create({
      data: {
        email: "target-resetpw-a@lotusdesk.local",
        name: "พนักงานเป้าหมาย (test)",
        passwordHash: await argon2.hash(targetOldPassword),
        isActive: true,
      },
    });
    targetUserId = target.id;
    await prisma.userBranch.create({ data: { userId: target.id, branchId, roleId: managerRole.id } });

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

    const targetLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "target-resetpw-a@lotusdesk.local", password: targetOldPassword });
    targetOldRefreshCookie = (targetLogin.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("refresh_token="),
    )!;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("manager (ไม่มี settings:manage) ต้องโดน 403", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/users/${targetUserId}/password`)
      .set("Cookie", managerCookies)
      .send({ newPassword: "NewPass123!" });
    expect(res.status).toBe(403);
  });

  it("รหัสผ่านสั้นเกินไป ต้องได้ 400", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/users/${targetUserId}/password`)
      .set("Cookie", ownerCookies)
      .send({ newPassword: "short" });
    expect(res.status).toBe(400);
  });

  // owner คนนี้สังกัดสาขา B ด้วย (เจ้าของหลายสาขา) แต่ user เป้าหมายไม่ได้อยู่สาขา B เลย — ผ่าน
  // PermissionGuard ได้ (สังกัดจริง) แต่ endpoint เองต้องปฏิเสธเพราะเป้าหมายไม่ได้อยู่สาขานี้
  it("user เป้าหมายไม่ได้สังกัดสาขาที่เรียก (แต่ผู้เรียกสังกัดอยู่) ต้องได้ 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${otherBranchId}/users/${targetUserId}/password`)
      .set("Cookie", ownerCookies)
      .send({ newPassword: "NewPass123!" });
    expect(res.status).toBe(404);
  });

  it("owner รีเซ็ตรหัสผ่านสำเร็จ — login รหัสเก่าไม่ได้อีก, รหัสใหม่ได้, refresh token เดิมถูกเพิกถอน", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/users/${targetUserId}/password`)
      .set("Cookie", ownerCookies)
      .send({ newPassword: "NewPass123!" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetUserId);

    const oldLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "target-resetpw-a@lotusdesk.local", password: targetOldPassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "target-resetpw-a@lotusdesk.local", password: "NewPass123!" });
    expect(newLogin.status).toBe(200);

    const refreshWithOldToken = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", targetOldRefreshCookie);
    expect(refreshWithOldToken.status).toBe(401);
  });
});

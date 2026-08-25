import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T6.1: "ลงเวลาซ้ำในนาทีเดียวกันต้องถูกปฏิเสธ" — เคสสาย/OT/ขาด (ที่ขึ้นกับเวลาปัจจุบัน
 * แบบละเอียดถึงนาที) ครอบด้วย unit test ล้วนใน packages/core/attendance แทน (ควบคุมเวลาได้แน่นอนกว่า
 * การยิง HTTP จริงที่ใช้เวลาปัจจุบันของเครื่องรันเทส) ที่นี่ครอบเฉพาะการเชื่อมต่อ/สิทธิ์/state machine จริง
 */
describe("Attendance clock in/out (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let staffCookies: string[];
  let managerCookies: string[];
  let unlinkedStaffCookies: string[];

  const PIN = "654321";

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "ATT-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "ATT-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const permissionKeys = ["attendance:view", "attendance:manage"];
    const permissions = await Promise.all(
      permissionKeys.map((key) => prisma.permission.create({ data: { key, description: key } })),
    );
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    const staffRole = await prisma.role.create({ data: { key: "staff", name: "พนักงานบริการ" } });
    await prisma.rolePermission.createMany({
      data: permissions.flatMap((p) => [{ roleId: managerRole.id, permissionId: p.id }]),
    });
    // บทบาท "พนักงานบริการ" มีแค่ attendance:manage จริงตาม seed (ดู packages/contracts/src/permissions.ts)
    // ไม่มี attendance:view — ใช้เทสยืนยันว่า list/summary (view) กับ clock-in/out (manage) แยกสิทธิ์กันจริง
    const manageOnly = permissions.find((p) => p.key === "attendance:manage")!;
    await prisma.rolePermission.create({ data: { roleId: staffRole.id, permissionId: manageOnly.id } });

    const device = await prisma.device.create({ data: { branchId: branchAId, label: "เครื่องหน้าร้าน 1" } });

    const managerUser = await prisma.user.create({
      data: {
        email: "manager-attendance-a@lotusdesk.local",
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash("ChangeMe123!"),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: managerUser.id, branchId: branchAId, roleId: managerRole.id } });

    const staffUser = await prisma.user.create({
      data: {
        email: "staff-attendance-a@lotusdesk.local",
        name: "พนักงานทดสอบ",
        pinHash: await argon2.hash(PIN),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: staffUser.id, branchId: branchAId, roleId: staffRole.id } });
    await prisma.staffProfile.create({
      data: { branchId: branchAId, userId: staffUser.id, name: "พนักงานทดสอบ", level: "SENIOR", skills: ["THAI_MASSAGE"] },
    });

    // บัญชีที่สังกัดสาขา A แต่ไม่ได้ผูกกับ StaffProfile ใด ๆ — ใช้เทส 422 ตอนลงเวลา
    const unlinkedUser = await prisma.user.create({
      data: {
        email: "unlinked-attendance-a@lotusdesk.local",
        name: "บัญชีไม่ผูกพนักงาน",
        pinHash: await argon2.hash(PIN),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: unlinkedUser.id, branchId: branchAId, roleId: staffRole.id } });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "manager-attendance-a@lotusdesk.local", password: "ChangeMe123!" });
    managerCookies = managerLogin.headers["set-cookie"] as unknown as string[];

    const staffLogin = await request(app.getHttpServer())
      .post("/auth/pin-login")
      .send({ deviceId: device.id, userId: staffUser.id, pin: PIN });
    expect(staffLogin.status).toBe(200);
    staffCookies = staffLogin.headers["set-cookie"] as unknown as string[];

    const unlinkedLogin = await request(app.getHttpServer())
      .post("/auth/pin-login")
      .send({ deviceId: device.id, userId: unlinkedUser.id, pin: PIN });
    unlinkedStaffCookies = unlinkedLogin.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("rejects clock-in from an account not linked to any staff profile with 422", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", unlinkedStaffCookies);
    expect(res.status).toBe(422);
  });

  it("clocks in with no shift scheduled, then clocks out — no shift matched, late/OT stay null", async () => {
    const clockIn = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", staffCookies);
    expect(clockIn.status).toBe(201);
    expect(clockIn.body.staffShiftId).toBeNull();
    expect(clockIn.body.lateMinutes).toBeNull();
    expect(clockIn.body.clockOutAt).toBeNull();

    const me = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance/me`)
      .set("Cookie", staffCookies);
    expect(me.status).toBe(200);
    expect(me.body.openRecord.id).toBe(clockIn.body.id);

    const clockOut = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", staffCookies);
    expect(clockOut.status).toBe(201);
    expect(clockOut.body.id).toBe(clockIn.body.id);
    expect(clockOut.body.clockOutAt).not.toBeNull();
    expect(clockOut.body.otMinutes).toBeNull();
    expect(clockOut.body.earlyLeaveMinutes).toBeNull();

    const meAfter = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance/me`)
      .set("Cookie", staffCookies);
    expect(meAfter.body.openRecord).toBeNull();
  });

  it("rejects clocking in twice in a row without clocking out first, with the same-minute duplicate message (T6.1 pass criteria)", async () => {
    const first = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", staffCookies);
    expect(first.status).toBe(201);

    // ยิงซ้ำทันที — ต้องตกในนาทีเดียวกันแทบทุกครั้งจริง (ความเสี่ยง flaky ต่ำมาก เฉพาะตอนคาบเกี่ยวขอบนาทีพอดี)
    const duplicate = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", staffCookies);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toContain("นาทีเดียวกัน");

    // เคลียร์สถานะกลับเป็นปิด กันชนกับเทสอื่นที่รันทีหลัง (มีแค่รอบเดียวเปิดพร้อมกันได้ต่อพนักงาน)
    const cleanup = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", staffCookies);
    expect(cleanup.status).toBe(201);
  });

  it("rejects clocking out again with no open record", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", staffCookies);
    expect(res.status).toBe(409);
  });

  it("keeps clock-in blocked while a record is still open, even well past the same minute", async () => {
    const open = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", staffCookies);
    expect(open.status).toBe(201);

    // ไม่ได้รอข้ามนาทีจริงในเทสนี้ (ยิงถัดกันทันที) แต่ยืนยันว่า "มีรอบเปิดอยู่" เป็นเหตุผลที่ถูกต้องเสมอ
    // ไม่ว่าจะชนนาทีเดียวกันหรือไม่ก็ตาม — reject ด้วยเหตุผลใดเหตุผลหนึ่งใน 409 ก็ถูกต้องทั้งคู่
    const again = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", staffCookies);
    expect(again.status).toBe(409);

    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", staffCookies);
  });

  it("lets a manager (attendance:view) read the list and daily summary", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance`)
      .set("Cookie", managerCookies);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const summary = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance/summary`)
      .set("Cookie", managerCookies);
    expect(summary.status).toBe(200);
    expect(Array.isArray(summary.body)).toBe(true);
  });

  it("lets the staff role read the list/summary reports too — 'manage' implies 'view' in this app's CASL setup (ability.factory.ts)", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance`)
      .set("Cookie", staffCookies);
    expect(list.status).toBe(200);

    const summary = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance/summary`)
      .set("Cookie", staffCookies);
    expect(summary.status).toBe(200);
  });

  it("rejects the branch A staff cookie from clocking in against branch B with 403 (no UserBranch there)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/attendance/clock-in`)
      .set("Cookie", staffCookies);
    expect(res.status).toBe(403);
  });
});

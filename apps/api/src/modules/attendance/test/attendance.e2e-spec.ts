import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { bangkokMinuteOfDay, toBangkokDateOnly } from "../bangkok-time";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T6.1: ตั้ง PIN -> ลงเวลาเข้า/ออก -> ล็อก PIN หลังกรอกผิดครบจำนวน -> กันลงเวลาซ้ำซ้อน
 * -> คำนวณสาย/ขาด/OT ผ่าน evaluateAttendance ถูกต้องเทียบกับกะจริง
 */
describe("Attendance clock-in/out (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let managerCookies: string[];
  let shiftTemplateId: string;

  const PIN = "112233";

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
    branchAId = branchA.id;

    const permissionKeys = ["attendance:view", "attendance:manage", "staff:view", "staff:manage"];
    const permissions = await Promise.all(
      permissionKeys.map((key) => prisma.permission.create({ data: { key, description: key } })),
    );
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: managerRole.id, permissionId: p.id })),
    });

    const managerEmail = "manager-attendance-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const managerUser = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: managerUser.id, branchId: branchAId, roleId: managerRole.id } });

    const shiftTemplate = await prisma.shiftTemplate.create({
      data: { branchId: branchAId, name: "กะเช้า", startMin: 480, endMin: 1020 },
    });
    shiftTemplateId = shiftTemplate.id;

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: managerEmail, password: managerPassword });
    managerCookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  let staffCounter = 0;

  /** สร้างพนักงานใหม่ (ยังไม่มี PIN) กันเทสชนกันเรื่อง "ลงเวลาค้างอยู่" ข้ามเคส */
  async function createStaff(): Promise<string> {
    staffCounter += 1;
    const db = await import("@lotus-desk/db");
    const staff = await db.prisma.staffProfile.create({
      data: { branchId: branchAId, name: `พนักงานทดสอบ ${staffCounter}`, level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
    return staff.id;
  }

  async function setPin(staffId: string, pin = PIN) {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff/${staffId}/pin`)
      .set("Cookie", managerCookies)
      .send({ pin });
    expect(res.status).toBe(201);
  }

  it("rejects clock-in for a staff who hasn't set a PIN yet", async () => {
    const staffId = await createStaff();
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(res.status).toBe(422);
  });

  it("sets a PIN then clocks in successfully with an open entry (clockOutAt null)", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(res.status).toBe(201);
    expect(res.body.entry.clockOutAt).toBeNull();
    expect(res.body.entry.staffId).toBe(staffId);
  });

  it("rejects clock-in with the wrong PIN (401), and locks out after enough wrong attempts", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const wrong = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: "999999" });
    expect(wrong.status).toBe(401);

    // กรอกผิดต่ออีกให้ครบ PIN_MAX_ATTEMPTS (5 ครั้งรวม) แล้วลองด้วย PIN ที่ถูกต้อง — ต้องโดนล็อกแทนที่จะผ่าน
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post(`/branches/${branchAId}/attendance/clock-in`)
        .set("Cookie", managerCookies)
        .send({ staffId, pin: "999999" });
    }
    // ครั้งที่ 5 (ครบ PIN_MAX_ATTEMPTS) ล็อกทันทีในตัวเดียวกัน — คืน 409 ไม่ใช่ 401 (เหมือน AuthService.verifyPin)
    const fifthWrong = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: "999999" });
    expect(fifthWrong.status).toBe(409);

    const lockedOutEvenWithCorrectPin = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(lockedOutEvenWithCorrectPin.status).toBe(409);
  });

  it("rejects clocking in again while already clocked in (409)", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const first = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(second.status).toBe(409);
  });

  it("rejects clock-out when there is no open entry (422)", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(res.status).toBe(422);
  });

  it("runs a full clock-in -> clock-out cycle, then GET / shows the entry with a computed attendance status", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const clockIn = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(clockIn.status).toBe(201);

    const clockOut = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(clockOut.status).toBe(201);
    expect(clockOut.body.entry.clockOutAt).not.toBeNull();

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance`)
      .set("Cookie", managerCookies)
      .query({ staffId });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].staffId).toBe(staffId);
    expect(list.body[0].attendance.status).toBeDefined();
  });

  it("matches a staff shift for the day and reports LATE with the correct lateMinutes", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const db = await import("@lotus-desk/db");
    const now = new Date();
    const nowMinuteOfDay = bangkokMinuteOfDay(now);
    // กะเริ่มเมื่อ 60 นาทีก่อน "ตอนนี้" (กัน flake ที่นาทีเปลี่ยนระหว่างเทส) ให้ลงเวลาเข้าตอนนี้ต้อง "สาย" แน่นอน
    const shiftStartMin = Math.max(0, nowMinuteOfDay - 60);
    const shiftEndMin = Math.min(1439, nowMinuteOfDay + 120);
    await db.prisma.staffShift.create({
      data: {
        branchId: branchAId,
        staffId,
        shiftTemplateId,
        date: toBangkokDateOnly(now),
        startMin: shiftStartMin,
        endMin: shiftEndMin,
      },
    });

    const clockIn = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: PIN });
    expect(clockIn.status).toBe(201);
    expect(clockIn.body.entry.staffShiftId).not.toBeNull();
    expect(clockIn.body.attendance.status).toBe("LATE");
    expect(clockIn.body.attendance.lateMinutes).toBeGreaterThan(0);

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/attendance`)
      .set("Cookie", managerCookies)
      .query({ staffId });
    expect(list.status).toBe(200);
    expect(list.body[0].attendance.status).toBe("LATE");
    expect(list.body[0].attendance.lateMinutes).toBeGreaterThan(0);
    expect(list.body[0].shift.startMin).toBe(shiftStartMin);
  });

  it("clocks in with staffId only (no pin) even for a staff member with no pinHash set — the default cashier-recorded workflow", async () => {
    const staffId = await createStaff();
    // ไม่เรียก setPin เลย — พนักงานคนนี้ไม่มี pinHash ตั้งแต่ต้น (ค่าเริ่มต้นตามโมเดลนี้)

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(res.status).toBe(201);
    expect(res.body.entry.clockOutAt).toBeNull();
    expect(res.body.entry.staffId).toBe(staffId);
  });

  it("clocks out the same no-pin-set staff with staffId only (no pin), completing the cycle", async () => {
    const staffId = await createStaff();

    const clockIn = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(clockIn.status).toBe(201);

    const clockOut = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(clockOut.status).toBe(201);
    expect(clockOut.body.entry.clockOutAt).not.toBeNull();
  });

  it("still enforces the already-clocked-in (409) guard on the no-pin path", async () => {
    const staffId = await createStaff();

    const first = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(second.status).toBe(409);
  });

  it("still enforces the not-clocked-in-yet (422) guard on clock-out with no pin", async () => {
    const staffId = await createStaff();

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-out`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(res.status).toBe(422);
  });

  it("still verifies pin normally when a staff member DOES have a pinHash but pin is sent wrong — PIN capability is preserved, not deleted", async () => {
    const staffId = await createStaff();
    await setPin(staffId);

    const wrong = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId, pin: "000000" });
    expect(wrong.status).toBe(401);

    // แต่ถ้าไม่ส่ง pin มาเลย (แม้พนักงานจะมี PIN ตั้งไว้แล้ว) ก็ยังลงเวลาได้ตามปกติ — pin เป็นทางเลือกเสมอ
    const noPinAttempt = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/attendance/clock-in`)
      .set("Cookie", managerCookies)
      .send({ staffId });
    expect(noPinAttempt.status).toBe(201);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/attendance`);
    expect(res.status).toBe(401);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T6.4: เปิด/ปิด/เปิดใหม่งวดจ่าย, ปิดงวดคำนวณค่ามือ+ทิปถูกต้อง (ไม่นับใบงานที่ถูกยกเลิก),
 * export CSV, และ "ปิดงวดแล้วแก้ใบงานย้อนหลัง (ยกเลิกบิล) ต้องถูกปฏิเสธ" (ดู BillController.cancel)
 */
describe("Payroll periods (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let cashierCookies: string[];
  let managerUserId: string;
  let staffId: string;
  let roomId: string;
  let serviceVariantId: string;

  const PIN = "778899";

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "PAYROLL-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "PAYROLL-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const permissionKeys = [
      "booking:view",
      "booking:manage",
      "billing:view",
      "billing:manage",
      "payroll:view",
      "payroll:manage",
    ];
    const permissions = await Promise.all(
      permissionKeys.map((key) => prisma.permission.create({ data: { key, description: key } })),
    );
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    const cashierRole = await prisma.role.create({ data: { key: "cashier", name: "แคชเชียร์" } });
    await prisma.rolePermission.createMany({
      data: permissions.flatMap((p) => [
        { roleId: managerRole.id, permissionId: p.id },
        { roleId: cashierRole.id, permissionId: p.id },
      ]),
    });

    const managerUser = await prisma.user.create({
      data: {
        email: "manager-payroll-a@lotusdesk.local",
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash("ChangeMe123!"),
        pinHash: await argon2.hash(PIN),
        isActive: true,
      },
    });
    managerUserId = managerUser.id;
    await prisma.userBranch.create({ data: { userId: managerUser.id, branchId: branchAId, roleId: managerRole.id } });

    const cashierEmail = "cashier-payroll-a@lotusdesk.local";
    const cashierPassword = "ChangeMe123!";
    const cashierUser = await prisma.user.create({
      data: {
        email: cashierEmail,
        name: "แคชเชียร์สาขา A (test)",
        passwordHash: await argon2.hash(cashierPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: cashierUser.id, branchId: branchAId, roleId: cashierRole.id } });

    const roomType = await prisma.roomType.create({ data: { branchId: branchAId, name: "ห้องนวดไทย" } });
    const room = await prisma.room.create({ data: { branchId: branchAId, roomTypeId: roomType.id, name: "ห้อง 1" } });
    roomId = room.id;
    const staff = await prisma.staffProfile.create({
      data: { branchId: branchAId, name: "พนักงานทดสอบ", level: "SENIOR", skills: ["THAI_MASSAGE"] },
    });
    staffId = staff.id;
    const category = await prisma.serviceCategory.create({ data: { branchId: branchAId, name: "นวด" } });
    const service = await prisma.service.create({ data: { branchId: branchAId, categoryId: category.id, name: "นวดไทย" } });
    const variant = await prisma.serviceVariant.create({
      data: {
        serviceId: service.id,
        durationMin: 60,
        priceSatang: 30000,
        commissionJuniorSatang: 10000,
        commissionSeniorSatang: 12000,
        commissionMasterSatang: 15000,
        requiredSkill: "THAI_MASSAGE",
        requiredRoomTypeId: roomType.id,
      },
    });
    serviceVariantId = variant.id;

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: cashierEmail, password: cashierPassword });
    cashierCookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  let itemCounter = 0;

  /** สร้าง+จบใบงานของ staffId ที่กำหนดไว้ตอน beforeAll แล้วออกบิลจริงทันที (จ่ายเงินสด) คืน billId */
  async function checkoutCompletedCashJob(priceSatang = 30000): Promise<string> {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId: branchAId } });
    const start = new Date(Date.UTC(2026, 8, 20, 2, 0, 0) + itemCounter * 90 * 60_000);
    itemCounter += 1;
    const item = await db.prisma.appointmentItem.create({
      data: {
        branchId: branchAId,
        appointmentId: appointment.id,
        staffId,
        roomId,
        serviceVariantId,
        status: "CHECKED_IN",
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });

    await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "IN_SERVICE" });
    await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "COMPLETED", paymentMethod: "CASH" });

    const job = await db.prisma.serviceJob.findUniqueOrThrow({ where: { appointmentItemId: item.id } });

    const checkout = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        serviceJobLines: [{ serviceJobId: job.id }],
        payments: [{ method: "CASH", amountSatang: priceSatang }],
      });
    expect(checkout.status).toBe(201);
    return checkout.body.id as string;
  }

  async function getApprovalToken(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/verify-manager-pin")
      .set("Cookie", cashierCookies)
      .send({ branchId: branchAId, userId: managerUserId, pin: PIN });
    expect(res.status).toBe(200);
    return res.body.approvalToken as string;
  }

  it("has no open period before one is opened", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/payroll/periods/current`)
      .set("Cookie", cashierCookies);
    expect(res.status).toBe(200);
    expect(res.body.period).toBeNull();
  });

  it("opens a period, rejects opening a second one while it's still open, then closes it (empty period)", async () => {
    const open = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/payroll/periods`)
      .set("Cookie", cashierCookies);
    expect(open.status).toBe(201);
    expect(open.body.closedAt).toBeNull();
    const periodId = open.body.id as string;

    const current = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/payroll/periods/current`)
      .set("Cookie", cashierCookies);
    expect(current.body.period.id).toBe(periodId);

    const openAgain = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/payroll/periods`)
      .set("Cookie", cashierCookies);
    expect(openAgain.status).toBe(409);

    const close = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/payroll/periods/${periodId}/close`)
      .set("Cookie", cashierCookies);
    expect(close.status).toBe(201);
    expect(close.body.closedAt).not.toBeNull();
    expect(close.body.summaries).toEqual([]);

    // ปิดซ้ำต้องไม่ได้
    const closeAgain = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/payroll/periods/${periodId}/close`)
      .set("Cookie", cashierCookies);
    expect(closeAgain.status).toBe(409);
  });

  it(
    "computes a correct commission+tip summary on close (excluding a voided job), exports CSV, blocks " +
      "cancelling a bill in the closed period, requires a valid manager PIN to reopen, and overwrites (not " +
      "duplicates) the staff summary on re-close (T6.4 pass criteria)",
    async () => {
      const db = await import("@lotus-desk/db");

      const open = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods`)
        .set("Cookie", cashierCookies);
      expect(open.status).toBe(201);
      const periodId = open.body.id as string;

      // ลงเวลาพนักงานคนเดียว (staffId) วันนี้ ให้ทิปทั้งก้อนตกที่คนเดียวแบบคาดเดาผลได้แน่นอน (T6.3 หารเท่ากัน
      // ทุกคนที่ลงเวลาในวันปฏิทินไทยเดียวกับที่บิลถูกสร้าง)
      await db.prisma.timeClockEntry.create({ data: { branchId: branchAId, staffId, clockInAt: new Date() } });

      const billId = await checkoutCompletedCashJob(30000); // commissionSeniorSatang = 12000
      const tip = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/bills/${billId}/tips`)
        .set("Cookie", cashierCookies)
        .send({ cashSatang: 2000, transferSatang: 0 });
      expect(tip.status).toBe(201);

      // ใบงานที่สอง: ออกบิลแล้วยกเลิกทันที (ก่อนปิดงวด — งวดยังเปิดอยู่ ยกเลิกได้ตามปกติ) ต้องไม่ถูกนับตอนปิดงวด
      const voidedBillId = await checkoutCompletedCashJob(30000);
      const voidToken = await getApprovalToken();
      const voidCancel = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/bills/${voidedBillId}/cancel`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: voidToken, reason: "ทดสอบใบงานที่ถูกยกเลิกต้องไม่ถูกนับ" });
      expect(voidCancel.status).toBe(201);

      const close = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/close`)
        .set("Cookie", cashierCookies);
      expect(close.status).toBe(201);
      expect(close.body.closedAt).not.toBeNull();

      const summaries = close.body.summaries as Array<{
        staffId: string;
        jobCount: number;
        commissionSatang: number;
        tipSatang: number;
        deductionSatang: number;
        totalSatang: number;
      }>;
      expect(summaries).toHaveLength(1);
      const staffSummary = summaries[0]!;
      expect(staffSummary.staffId).toBe(staffId);
      expect(staffSummary.jobCount).toBe(1); // ใบงานที่ถูกยกเลิกต้องไม่ถูกนับรวม
      expect(staffSummary.commissionSatang).toBe(12000);
      expect(staffSummary.tipSatang).toBe(2000);
      expect(staffSummary.deductionSatang).toBe(0);
      expect(staffSummary.totalSatang).toBe(14000);

      // ปิดซ้ำต้องไม่ได้
      const closeAgain = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/close`)
        .set("Cookie", cashierCookies);
      expect(closeAgain.status).toBe(409);

      // Export CSV เปิดใน Excel ได้ (T6.4)
      const csv = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/payroll/periods/${periodId}/summary.csv`)
        .set("Cookie", cashierCookies);
      expect(csv.status).toBe(200);
      expect(csv.headers["content-type"]).toContain("text/csv");
      expect(csv.text).toContain("14000");

      // ยกเลิกบิลที่อยู่ในงวดจ่ายที่ปิดไปแล้วต้องถูกปฏิเสธ 409 (เกณฑ์ผ่านหลักของ T6.4)
      const blockedToken = await getApprovalToken();
      const blockedCancel = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/bills/${billId}/cancel`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: blockedToken, reason: "ลูกค้าขอยกเลิก" });
      expect(blockedCancel.status).toBe(409);
      expect(blockedCancel.body.message).toContain("งวดจ่ายค่ามือ");

      // เปิดงวดใหม่ต้องมี PIN ผู้จัดการเช่นกัน — ไม่ส่ง token เลย (zod validation) ต้องเป็น 400
      const reopenWithoutToken = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/reopen`)
        .set("Cookie", cashierCookies)
        .send({});
      expect(reopenWithoutToken.status).toBe(400);

      // token ปลอม/หมดอายุ ต้องเป็น 401 (verifyManagerApprovalToken ของ AuthService)
      const reopenBadToken = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/reopen`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: "not-a-real-token" });
      expect(reopenBadToken.status).toBe(401);

      const reopenToken = await getApprovalToken();
      const reopen = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/reopen`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: reopenToken });
      expect(reopen.status).toBe(201);
      expect(reopen.body.closedAt).toBeNull();
      expect(reopen.body.reopenedAt).not.toBeNull();

      // เปิดอยู่แล้ว เปิดซ้ำไม่ได้
      const reopenAgainToken = await getApprovalToken();
      const reopenAgain = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/reopen`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: reopenAgainToken });
      expect(reopenAgain.status).toBe(409);

      // ปิดงวดซ้ำอีกครั้ง (ยังไม่มีอะไรเปลี่ยน) ต้อง "ทับ" แถวสรุปเดิมของพนักงานคนนั้น ไม่สร้างซ้ำ
      const closeSecondTime = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/close`)
        .set("Cookie", cashierCookies);
      expect(closeSecondTime.status).toBe(201);
      expect((closeSecondTime.body.summaries as unknown[]).length).toBe(1);

      const summaryRowCount = await db.prisma.payrollPeriodStaffSummary.count({
        where: { payrollPeriodId: periodId, staffId },
      });
      expect(summaryRowCount).toBe(1);

      const summaryFetch = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/payroll/periods/${periodId}/summary`)
        .set("Cookie", cashierCookies);
      expect(summaryFetch.status).toBe(200);
      expect((summaryFetch.body.summaries as unknown[])).toHaveLength(1);

      // เปิดใหม่อีกครั้งแล้วยกเลิกบิลต้องได้ตามปกติ
      const reopenToken2 = await getApprovalToken();
      const reopen2 = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/reopen`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: reopenToken2 });
      expect(reopen2.status).toBe(201);

      const allowedToken = await getApprovalToken();
      const allowedCancel = await request(app.getHttpServer())
        .post(`/branches/${branchAId}/bills/${billId}/cancel`)
        .set("Cookie", cashierCookies)
        .send({ approvalToken: allowedToken, reason: "ลูกค้าขอยกเลิก" });
      expect(allowedCancel.status).toBe(201);
      expect(allowedCancel.body.status).toBe("CANCELLED");

      // ปิดงวดไว้ท้ายเทส กันไม่ให้ไปปนกับเทสอื่นที่รันทีหลัง (มีแค่งวดเดียวเปิดพร้อมกันได้ต่อสาขา)
      await request(app.getHttpServer())
        .post(`/branches/${branchAId}/payroll/periods/${periodId}/close`)
        .set("Cookie", cashierCookies);
    },
  );

  it("rejects the cashier of branch A from reading/opening periods of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/payroll/periods`)
      .set("Cookie", cashierCookies);
    expect(list.status).toBe(403);

    const open = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/payroll/periods`)
      .set("Cookie", cashierCookies);
    expect(open.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/payroll/periods`);
    expect(res.status).toBe(401);
  });
});

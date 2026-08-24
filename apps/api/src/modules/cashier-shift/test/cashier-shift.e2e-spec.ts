import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T5.7: "ปิดรอบแล้วแก้บิลต้องได้ 409 พร้อมบอกว่าต้องให้ผู้จัดการเปิดรอบก่อน"
 */
describe("Cashier shifts (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let cashierCookies: string[];
  let managerUserId: string;
  let staffId: string;
  let roomId: string;
  let serviceVariantId: string;

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "SHIFT-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "SHIFT-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const permissionKeys = ["booking:view", "booking:manage", "billing:view", "billing:manage"];
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
        email: "manager-shift-a@lotusdesk.local",
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash("ChangeMe123!"),
        pinHash: await argon2.hash(PIN),
        isActive: true,
      },
    });
    managerUserId = managerUser.id;
    await prisma.userBranch.create({ data: { userId: managerUser.id, branchId: branchAId, roleId: managerRole.id } });

    const cashierEmail = "cashier-shift-a@lotusdesk.local";
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

  /** สร้าง+จบใบงานที่จ่ายด้วยเงินสด แล้วออกบิลจริงทันที คืน billId */
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

  it("has no open shift before one is opened", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/cashier-shifts/current`)
      .set("Cookie", cashierCookies);
    expect(res.status).toBe(200);
    expect(res.body.shift).toBeNull();
  });

  it("opens a shift, rejects opening a second one while it's still open, then closes it with matching cash", async () => {
    const open = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts`)
      .set("Cookie", cashierCookies);
    expect(open.status).toBe(201);
    expect(open.body.closedAt).toBeNull();
    const shiftId = open.body.id as string;

    const current = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/cashier-shifts/current`)
      .set("Cookie", cashierCookies);
    expect(current.body.shift.id).toBe(shiftId);

    const openAgain = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts`)
      .set("Cookie", cashierCookies);
    expect(openAgain.status).toBe(409);

    // ยังไม่มีบิลเงินสดใด ๆ ในรอบนี้ — ยอดระบบต้องเป็น 0 นับได้ตรง ปิดได้โดยไม่ต้องใส่เหตุผล
    const close = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/close`)
      .set("Cookie", cashierCookies)
      .send({ countedCashSatang: 0 });
    expect(close.status).toBe(201);
    expect(close.body.systemCashSatang).toBe(0);
    expect(close.body.varianceSatang).toBe(0);
    expect(close.body.closedAt).not.toBeNull();

    // ปิดซ้ำต้องไม่ได้
    const closeAgain = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/close`)
      .set("Cookie", cashierCookies)
      .send({ countedCashSatang: 0 });
    expect(closeAgain.status).toBe(409);
  });

  it("computes the system cash total from real CASH bills, and requires a reason when the count doesn't match", async () => {
    const open = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts`)
      .set("Cookie", cashierCookies);
    const shiftId = open.body.id as string;

    await checkoutCompletedCashJob(30000);

    const closeWithoutReason = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/close`)
      .set("Cookie", cashierCookies)
      .send({ countedCashSatang: 29500 });
    expect(closeWithoutReason.status).toBe(422);

    const close = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/close`)
      .set("Cookie", cashierCookies)
      .send({ countedCashSatang: 29500, varianceReason: "ทอนเงินผิดให้ลูกค้าคนหนึ่ง" });
    expect(close.status).toBe(201);
    expect(close.body.systemCashSatang).toBe(30000);
    expect(close.body.countedCashSatang).toBe(29500);
    expect(close.body.varianceSatang).toBe(-500);
    expect(close.body.varianceReason).toBe("ทอนเงินผิดให้ลูกค้าคนหนึ่ง");
  });

  it("blocks cancelling a bill whose shift is closed with 409, then allows it again after a manager reopens the shift (T5.7 pass criteria)", async () => {
    const open = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts`)
      .set("Cookie", cashierCookies);
    const shiftId = open.body.id as string;

    const billId = await checkoutCompletedCashJob(30000);

    const close = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/close`)
      .set("Cookie", cashierCookies)
      .send({ countedCashSatang: 30000 });
    expect(close.status).toBe(201);

    const approvalToken1 = await getApprovalToken();
    const blockedCancel = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken: approvalToken1, reason: "ลูกค้าขอยกเลิก" });
    expect(blockedCancel.status).toBe(409);
    expect(blockedCancel.body.message).toContain("เปิดรอบกะ");

    // เปิดรอบกะใหม่ต้องมี PIN ผู้จัดการเช่นกัน
    const reopenWithoutToken = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/reopen`)
      .set("Cookie", cashierCookies)
      .send({});
    expect(reopenWithoutToken.status).toBe(400);

    const reopenToken = await getApprovalToken();
    const reopen = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/reopen`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken: reopenToken });
    expect(reopen.status).toBe(201);
    expect(reopen.body.closedAt).toBeNull();
    expect(reopen.body.reopenedAt).not.toBeNull();

    // เปิดอยู่แล้ว เปิดซ้ำไม่ได้
    const reopenAgainToken = await getApprovalToken();
    const reopenAgain = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/reopen`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken: reopenAgainToken });
    expect(reopenAgain.status).toBe(409);

    const approvalToken2 = await getApprovalToken();
    const allowedCancel = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken: approvalToken2, reason: "ลูกค้าขอยกเลิก" });
    expect(allowedCancel.status).toBe(201);
    expect(allowedCancel.body.status).toBe("CANCELLED");

    // ปิดรอบกะไว้ กันไม่ให้ไปปนกับเทสอื่นที่รันทีหลัง (มีแค่รอบกะเดียวเปิดพร้อมกันได้ต่อสาขา)
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/cashier-shifts/${shiftId}/close`)
      .set("Cookie", cashierCookies)
      .send({ countedCashSatang: 0, varianceReason: "ปิดท้ายเทส" });
  });

  it("rejects the cashier of branch A from reading/opening shifts of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/cashier-shifts`)
      .set("Cookie", cashierCookies);
    expect(list.status).toBe(403);

    const open = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/cashier-shifts`)
      .set("Cookie", cashierCookies);
    expect(open.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/cashier-shifts`);
    expect(res.status).toBe(401);
  });
});

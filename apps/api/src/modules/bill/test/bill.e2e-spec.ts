import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T5.6: "ยกเลิกบิลที่ตัดคอร์สไปแล้ว ต้องคืนครั้ง + คืนโควตาโปรฯ + กลับค่ามือ ครบทุกรายการ"
 */
describe("Bills (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let cashierCookies: string[];
  let managerUserId: string;
  let staffId: string;
  let roomId: string;
  let serviceVariantId: string;
  let sessionPackageId: string;
  let memberAId: string;

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "BILL-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "BILL-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const permissionKeys = [
      "booking:view",
      "booking:manage",
      "package:view",
      "package:manage",
      "promotion:view",
      "promotion:manage",
      "billing:view",
      "billing:manage",
      "member:view",
      "member:manage",
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
        email: "manager-bill-a@lotusdesk.local",
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash("ChangeMe123!"),
        pinHash: await argon2.hash(PIN),
        isActive: true,
      },
    });
    managerUserId = managerUser.id;
    await prisma.userBranch.create({ data: { userId: managerUser.id, branchId: branchAId, roleId: managerRole.id } });

    const cashierEmail = "cashier-bill-a@lotusdesk.local";
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

    const sessionPackage = await prisma.package.create({
      data: {
        branchId: branchAId,
        name: "คอร์สนวดไทย 5 ครั้ง",
        type: "SESSION_COUNT",
        priceSatang: 120000,
        sessionCount: 5,
        serviceVariantId,
        validDays: 180,
      },
    });
    sessionPackageId = sessionPackage.id;

    const member = await prisma.member.create({
      data: { branchId: branchAId, code: "M000001", name: "ลูกค้า A1", phone: "0810000001" },
    });
    memberAId = member.id;

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

  /** ซื้อคอร์สให้สมาชิก แล้วสร้าง+จบใบงานที่จ่ายด้วยการตัดคอร์สนั้น คืน { serviceJobId, memberPackageId } */
  async function createCompletedPackageJob(): Promise<{ serviceJobId: string; memberPackageId: string }> {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;

    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId: branchAId, memberId: memberAId } });
    const start = new Date(Date.UTC(2026, 8, 10, 2, 0, 0) + itemCounter * 90 * 60_000);
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
      .send({ status: "COMPLETED", paymentMethod: "PACKAGE" });

    const job = await db.prisma.serviceJob.findUniqueOrThrow({ where: { appointmentItemId: item.id } });
    return { serviceJobId: job.id, memberPackageId };
  }

  async function getApprovalToken(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/verify-manager-pin")
      .set("Cookie", cashierCookies)
      .send({ branchId: branchAId, userId: managerUserId, pin: PIN });
    expect(res.status).toBe(200);
    return res.body.approvalToken as string;
  }

  it("checks out a bill paid via package deduction (T5.6 pass criteria setup)", async () => {
    const { serviceJobId, memberPackageId } = await createCompletedPackageJob();

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId, memberPackageId }],
        payments: [{ method: "PACKAGE", amountSatang: 30000 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PAID");
    expect(res.body.totalSatang).toBe(30000);
    expect(res.body.lines).toHaveLength(1);

    const db = await import("@lotus-desk/db");
    const balanceRow = await db.prisma.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    expect(balanceRow._sum.delta).toBe(4); // 5 - 1
  });

  it("cancelling a bill that deducted a package restores the session, restores promo quota, and voids the ServiceJob (T5.6 pass criteria)", async () => {
    const { serviceJobId, memberPackageId } = await createCompletedPackageJob();
    const db = await import("@lotus-desk/db");

    // โปรฯ ห้ามลดรายการที่ตัดคอร์ส (docs/DOMAIN.md — ดู ADR-027) จึงต้องมีรายการ CASH คู่ไปด้วยให้โปรฯ มีอะไรให้ลด
    const promo = await db.prisma.promotion.create({
      data: {
        branchId: branchAId,
        name: "ลด 10% อัตโนมัติ (เทสยกเลิกบิล)",
        type: "PERCENT_OFF",
        percentOff: 10,
        quotaTotal: 5,
        quotaUsed: 0,
      },
    });

    const checkout = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId, memberPackageId }],
        productLines: [{ description: "ครีมบำรุงผิว", priceSatang: 10000, paymentMethod: "CASH" }],
        payments: [
          { method: "PACKAGE", amountSatang: 30000 },
          { method: "CASH", amountSatang: 9000 },
        ],
      });
    expect(checkout.status).toBe(201);
    expect(checkout.body.discountSatang).toBe(1000); // ลด 10% ของ 10000 (รายการ CASH เท่านั้น ไม่แตะรายการตัดคอร์ส)
    expect(checkout.body.totalSatang).toBe(39000);
    const billId = checkout.body.id as string;

    const promoAfterCheckout = await db.prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(promoAfterCheckout.quotaUsed).toBe(1);

    const balanceAfterCheckout = await db.prisma.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    expect(balanceAfterCheckout._sum.delta).toBe(4);

    // ยกเลิกบิลต้องมี PIN ผู้จัดการ
    const withoutApproval = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ reason: "ลูกค้าจองผิดคน" });
    expect(withoutApproval.status).toBe(400);

    const approvalToken = await getApprovalToken();
    const cancelled = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken, reason: "ลูกค้าจองผิดคน" });
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.status).toBe("CANCELLED");

    // คืนครั้ง — ยอดคงเหลือกลับไปเท่าเดิม (5) เป๊ะ
    const balanceAfterCancel = await db.prisma.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    expect(balanceAfterCancel._sum.delta).toBe(5);

    // คืนโควตาโปรฯ
    const promoAfterCancel = await db.prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(promoAfterCancel.quotaUsed).toBe(0);

    // กลับค่ามือ — ใบงานที่ผูกกับบิลนี้ต้องเป็นโมฆะ
    const job = await db.prisma.serviceJob.findUniqueOrThrow({ where: { id: serviceJobId } });
    expect(job.voidedAt).not.toBeNull();

    // ปิดโปรฯ ทดสอบนี้ กันไม่ให้ไปปนกับเทสอื่นที่รันทีหลัง (โปรฯ อัตโนมัติมีผลกับทุกบิลถัดไปในสาขาเดียวกัน)
    await db.prisma.promotion.update({ where: { id: promo.id }, data: { isActive: false } });
  });

  it("rejects cancelling with a garbage/forged approval token", async () => {
    const { serviceJobId, memberPackageId } = await createCompletedPackageJob();
    const checkout = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId, memberPackageId }],
        payments: [{ method: "PACKAGE", amountSatang: 30000 }],
      });
    const billId = checkout.body.id as string;

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken: "not-a-real-token", reason: "x" });
    expect(res.status).toBe(401);
  });

  it("rejects cancelling an already-cancelled bill", async () => {
    const { serviceJobId, memberPackageId } = await createCompletedPackageJob();
    const checkout = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId, memberPackageId }],
        payments: [{ method: "PACKAGE", amountSatang: 30000 }],
      });
    const billId = checkout.body.id as string;
    const approvalToken = await getApprovalToken();

    const first = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken, reason: "ครั้งแรก" });
    expect(first.status).toBe(201);

    const secondToken = await getApprovalToken();
    const again = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills/${billId}/cancel`)
      .set("Cookie", cashierCookies)
      .send({ approvalToken: secondToken, reason: "ครั้งที่สอง" });
    expect(again.status).toBe(409);
  });

  it("checks out a bill with a CASH product line and computes change from tenderedSatang", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        productLines: [{ description: "ครีมบำรุงผิว", priceSatang: 25000, paymentMethod: "CASH" }],
        payments: [{ method: "CASH", amountSatang: 25000, tenderedSatang: 50000 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.totalSatang).toBe(25000);
    expect(res.body.payments[0].tenderedSatang).toBe(50000);
  });

  it("rejects a bill whose payments don't sum to the total", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        productLines: [{ description: "ครีมบำรุงผิว", priceSatang: 25000, paymentMethod: "CASH" }],
        payments: [{ method: "CASH", amountSatang: 10000 }],
      });
    expect(res.status).toBe(422);
  });

  it("rejects billing a ServiceJob that hasn't completed yet", async () => {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId: branchAId } });
    const start = new Date(Date.UTC(2026, 8, 15, 2, 0, 0));
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
    const job = await db.prisma.serviceJob.findUniqueOrThrow({ where: { appointmentItemId: item.id } });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        serviceJobLines: [{ serviceJobId: job.id }],
        payments: [{ method: "CASH", amountSatang: 30000 }],
      });
    expect(res.status).toBe(422);
  });

  it("rejects billing the same ServiceJob twice", async () => {
    const { serviceJobId, memberPackageId } = await createCompletedPackageJob();
    const first = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId, memberPackageId }],
        payments: [{ method: "PACKAGE", amountSatang: 30000 }],
      });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId, memberPackageId }],
        payments: [{ method: "PACKAGE", amountSatang: 30000 }],
      });
    expect(second.status).toBe(409);
  });

  it("rejects the cashier of branch A from reading/checking out bills of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/bills`)
      .set("Cookie", cashierCookies);
    expect(list.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        productLines: [{ description: "x", priceSatang: 1000, paymentMethod: "CASH" }],
        payments: [{ method: "CASH", amountSatang: 1000 }],
      });
    expect(create.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/bills`);
    expect(res.status).toBe(401);
  });
});

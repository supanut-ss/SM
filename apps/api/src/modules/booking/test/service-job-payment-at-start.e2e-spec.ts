import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ docs/decisions.md ADR-046 (พลิกกลับ ADR-029 ข้อ 4 ตามคำสั่งเจ้าของร้าน): แหล่งชำระ+
 * คอร์สที่จะตัดตัดสินใจ+ตรวจสิทธิ์ตอนเริ่มงาน (IN_SERVICE) ไม่ใช่ตอนจบงานอีกต่อไป — แต่การตัด ledger จริงยัง
 * เกิดที่ checkout เหมือนเดิม (ดู bill.controller.ts) เทสต์นี้ครอบทั้งเส้นทางสำเร็จและเส้นทาง reject พร้อม
 * ยืนยันว่า rollback ทำงานจริง (ไม่ใช่แค่สมมติตามพฤติกรรมปกติของ Prisma $transaction)
 */
describe("ServiceJob payment decision moved to job start (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let cashierCookies: string[];
  let staffId: string;
  let roomId: string;
  let serviceVariantId: string;
  let otherServiceVariantId: string;
  let sessionPackageId: string;
  let memberAId: string;
  let memberBId: string;

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "SVCJOB-START-A" } });
    branchId = branch.id;

    const permissionKeys = ["booking:view", "booking:manage", "package:view", "package:manage", "billing:manage"];
    const permissions = await Promise.all(
      permissionKeys.map((key) => prisma.permission.create({ data: { key, description: key } })),
    );
    const cashierRole = await prisma.role.create({ data: { key: "cashier", name: "แคชเชียร์" } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: cashierRole.id, permissionId: p.id })),
    });

    const cashierEmail = "cashier-svcjob-start-a@lotusdesk.local";
    const cashierPassword = "ChangeMe123!";
    const cashierUser = await prisma.user.create({
      data: {
        email: cashierEmail,
        name: "แคชเชียร์สาขา A (test)",
        passwordHash: await argon2.hash(cashierPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: cashierUser.id, branchId, roleId: cashierRole.id } });

    const roomType = await prisma.roomType.create({ data: { branchId, name: "ห้องนวดไทย" } });
    const room = await prisma.room.create({ data: { branchId, roomTypeId: roomType.id, name: "ห้อง 1" } });
    roomId = room.id;
    const staff = await prisma.staffProfile.create({
      data: { branchId, name: "พนักงานทดสอบ", level: "SENIOR", skills: ["THAI_MASSAGE"] },
    });
    staffId = staff.id;
    const category = await prisma.serviceCategory.create({ data: { branchId, name: "นวด" } });
    const service = await prisma.service.create({ data: { branchId, categoryId: category.id, name: "นวดไทย" } });
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

    const otherVariant = await prisma.serviceVariant.create({
      data: {
        serviceId: service.id,
        durationMin: 90,
        priceSatang: 45000,
        commissionJuniorSatang: 15000,
        commissionSeniorSatang: 18000,
        commissionMasterSatang: 22000,
        requiredSkill: "THAI_MASSAGE",
        requiredRoomTypeId: roomType.id,
      },
    });
    otherServiceVariantId = otherVariant.id;

    const sessionPackage = await prisma.package.create({
      data: {
        branchId,
        name: "คอร์สนวดไทย 2 ครั้ง",
        type: "SESSION_COUNT",
        priceSatang: 50000,
        sessionCount: 2,
        serviceVariantId,
        validDays: 180,
      },
    });
    sessionPackageId = sessionPackage.id;

    const memberA = await prisma.member.create({
      data: { branchId, code: "MSTART001", name: "ลูกค้า A", phone: "0820000001" },
    });
    memberAId = memberA.id;
    const memberB = await prisma.member.create({
      data: { branchId, code: "MSTART002", name: "ลูกค้า B", phone: "0820000002" },
    });
    memberBId = memberB.id;

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

  async function createCheckedInItem(opts?: { memberId?: string; serviceVariantId?: string }) {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({
      data: { branchId, memberId: opts?.memberId ?? null },
    });
    const start = new Date(Date.UTC(2026, 8, 14, 2, 0, 0) + itemCounter * 90 * 60_000);
    itemCounter += 1;
    return db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId,
        roomId,
        serviceVariantId: opts?.serviceVariantId ?? serviceVariantId,
        status: "CHECKED_IN",
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });
  }

  async function purchasePackage(memberId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/members/${memberId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it("starting a job with paymentMethod PACKAGE and a valid, sufficient-balance package succeeds — the created ServiceJob has memberPackageId set", async () => {
    const memberPackageId = await purchasePackage(memberAId);
    const item = await createCheckedInItem({ memberId: memberAId });

    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "IN_SERVICE", paymentMethod: "PACKAGE", memberPackageId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_SERVICE");

    const db = await import("@lotus-desk/db");
    const job = await db.prisma.serviceJob.findUniqueOrThrow({ where: { appointmentItemId: item.id } });
    expect(job.paymentMethod).toBe("PACKAGE");
    expect(job.memberPackageId).toBe(memberPackageId);
    // ตรวจสิทธิ์ล่วงหน้าเท่านั้น — ยังไม่ตัด ledger จริงตอนเริ่มงาน (ตัดจริงตอน checkout)
    const balance = await db.prisma.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    expect(balance._sum.delta).toBe(2); // ยังเต็ม 2 ครั้ง ไม่ถูกตัดเลย
  });

  it("rejects starting a job with an INSUFFICIENT-balance package with 422, and the AppointmentItem status did NOT change + no ServiceJob row was created (transaction rolled back)", async () => {
    const memberPackageId = await purchasePackage(memberAId);
    const db = await import("@lotus-desk/db");

    // ใช้ยอดจนหมด (2 ครั้ง) ผ่าน endpoint ตัดใช้ตรง ๆ ก่อน ให้เหลือ 0
    await db.prisma.memberPackageLedgerEntry.create({
      data: { branchId, memberPackageId, kind: "USE", delta: -2, note: "เทสให้ยอดหมดก่อน" },
    });

    const item = await createCheckedInItem({ memberId: memberAId });
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "IN_SERVICE", paymentMethod: "PACKAGE", memberPackageId });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain("ไม่พอ");

    const itemAfter = await db.prisma.appointmentItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemAfter.status).toBe("CHECKED_IN"); // ไม่ขยับไป IN_SERVICE เลย — ทั้ง transaction rollback

    const job = await db.prisma.serviceJob.findUnique({ where: { appointmentItemId: item.id } });
    expect(job).toBeNull(); // ไม่มี ServiceJob ถูกสร้างขึ้นเลย
  });

  it("rejects starting a job with a package belonging to a DIFFERENT member than the appointment's member, and rolls back", async () => {
    const memberPackageId = await purchasePackage(memberBId); // เป็นของสมาชิก B
    const item = await createCheckedInItem({ memberId: memberAId }); // นัดของสมาชิก A

    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "IN_SERVICE", paymentMethod: "PACKAGE", memberPackageId });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain("ไม่ใช่ของสมาชิก");

    const db = await import("@lotus-desk/db");
    const itemAfter = await db.prisma.appointmentItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemAfter.status).toBe("CHECKED_IN");
    const job = await db.prisma.serviceJob.findUnique({ where: { appointmentItemId: item.id } });
    expect(job).toBeNull();
  });

  it("rejects starting a job with a package that doesn't apply to this ServiceVariant, and rolls back", async () => {
    const memberPackageId = await purchasePackage(memberAId); // ผูกกับ serviceVariantId เดิม
    const item = await createCheckedInItem({ memberId: memberAId, serviceVariantId: otherServiceVariantId });

    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "IN_SERVICE", paymentMethod: "PACKAGE", memberPackageId });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain("ใช้กับบริการนี้ไม่ได้");

    const db = await import("@lotus-desk/db");
    const itemAfter = await db.prisma.appointmentItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemAfter.status).toBe("CHECKED_IN");
    const job = await db.prisma.serviceJob.findUnique({ where: { appointmentItemId: item.id } });
    expect(job).toBeNull();
  });

  it("walk-in path: start (PACKAGE + picker) → complete (no paymentMethod needed) → checkout — uses the memberPackageId locked in at start without the client supplying one, deducting exactly once for the right amount", async () => {
    const memberPackageId = await purchasePackage(memberAId);
    const item = await createCheckedInItem({ memberId: memberAId });

    const start = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "IN_SERVICE", paymentMethod: "PACKAGE", memberPackageId });
    expect(start.status).toBe(200);

    const complete = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", cashierCookies)
      .send({ status: "COMPLETED" }); // ไม่ต้องส่ง paymentMethod อีกแล้ว
    expect(complete.status).toBe(200);

    const db = await import("@lotus-desk/db");
    const job = await db.prisma.serviceJob.findUniqueOrThrow({ where: { appointmentItemId: item.id } });
    expect(job.completedAt).not.toBeNull();
    expect(job.paymentMethod).toBe("PACKAGE");
    expect(job.memberPackageId).toBe(memberPackageId);

    // checkout ไม่ต้องส่ง memberPackageId มาอีกแล้ว (ล็อกไว้ตั้งแต่ตอนเริ่มงาน) — ยังไม่ถูกตัดยอดจริงจนกว่าจะถึงตรงนี้
    const balanceBeforeCheckout = await db.prisma.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    expect(balanceBeforeCheckout._sum.delta).toBe(2);

    const checkout = await request(app.getHttpServer())
      .post(`/branches/${branchId}/bills`)
      .set("Cookie", cashierCookies)
      .send({
        memberId: memberAId,
        serviceJobLines: [{ serviceJobId: job.id }],
        payments: [{ method: "PACKAGE", amountSatang: 30000 }],
      });
    expect(checkout.status).toBe(201);
    expect(checkout.body.lines).toHaveLength(1);
    expect(checkout.body.lines[0].memberPackageId).toBe(memberPackageId);

    const balanceAfterCheckout = await db.prisma.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    expect(balanceAfterCheckout._sum.delta).toBe(1); // ตัดไปครั้งเดียว (2 - 1)

    const ledgerEntries = await db.prisma.memberPackageLedgerEntry.findMany({ where: { memberPackageId } });
    const useEntries = ledgerEntries.filter((e) => e.kind === "USE");
    expect(useEntries).toHaveLength(1); // ตัดยอดจริงเกิดขึ้นครั้งเดียวเท่านั้น (ที่ checkout ไม่ใช่ตอนเริ่มงาน)
    expect(useEntries[0]!.delta).toBe(-1);
  });
});

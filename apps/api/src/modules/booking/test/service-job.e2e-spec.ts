import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/booking/test/appointment-item-status.e2e-spec.ts (T4.3)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T5.5: "แก้ราคาบริการแล้ว ใบงานเก่าและรายงานย้อนหลังต้องไม่เปลี่ยนแม้แต่บาทเดียว"
 */
describe("ServiceJob snapshot on start/complete (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let managerCookies: string[];
  let staffId: string;
  let roomId: string;
  let serviceVariantId: string;

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "SVCJOB-A" } });
    branchId = branch.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "booking:view", description: "ดูการจอง" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "booking:manage", description: "จัดการการจอง" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-svcjob-a@lotusdesk.local";
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
      data: { userId: manager.id, branchId, roleId: managerRole.id },
    });

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

  let itemCounter = 0;

  async function createCheckedInItem() {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const start = new Date(Date.UTC(2026, 8, 10, 2, 0, 0) + itemCounter * 90 * 60_000);
    itemCounter += 1;
    const end = new Date(start.getTime() + 60 * 60_000);
    return db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId,
        roomId,
        serviceVariantId,
        status: "CHECKED_IN",
        startAt: start,
        endAt: end,
        roomCapacityAtBooking: 1,
      },
    });
  }

  it("creates a ServiceJob automatically when entering IN_SERVICE, snapshotting price and the staff's commission rate", async () => {
    const item = await createCheckedInItem();
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "IN_SERVICE" });
    expect(res.status).toBe(200);

    const db = await import("@lotus-desk/db");
    const job = await db.prisma.serviceJob.findUnique({ where: { appointmentItemId: item.id } });
    expect(job).not.toBeNull();
    expect(job!.priceSatang).toBe(30000);
    expect(job!.staffLevelAtJob).toBe("SENIOR");
    expect(job!.commissionSatang).toBe(12000); // เรตของ SENIOR ไม่ใช่ JUNIOR/MASTER
    expect(job!.startedAt).not.toBeNull();
    expect(job!.completedAt).toBeNull();
    expect(job!.paymentMethod).toBeNull();
  });

  it("rejects completing without a paymentMethod, requires it, then closes the job with completedAt + paymentMethod", async () => {
    const item = await createCheckedInItem();
    await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "IN_SERVICE" });

    const withoutPayment = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "COMPLETED" });
    expect(withoutPayment.status).toBe(400);

    const withPayment = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "COMPLETED", paymentMethod: "PACKAGE" });
    expect(withPayment.status).toBe(200);

    const db = await import("@lotus-desk/db");
    const job = await db.prisma.serviceJob.findUnique({ where: { appointmentItemId: item.id } });
    expect(job!.completedAt).not.toBeNull();
    expect(job!.paymentMethod).toBe("PACKAGE");
  });

  it("keeps an old ServiceJob's snapshotted price/commission unchanged after the ServiceVariant's live price/commission is edited (T5.5 pass criteria)", async () => {
    const item = await createCheckedInItem();
    await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "IN_SERVICE" });

    const db = await import("@lotus-desk/db");
    const jobBeforePriceChange = await db.prisma.serviceJob.findUnique({
      where: { appointmentItemId: item.id },
    });
    expect(jobBeforePriceChange!.priceSatang).toBe(30000);
    expect(jobBeforePriceChange!.commissionSatang).toBe(12000);

    // แก้ราคา/ค่ามือของ ServiceVariant ตัวเดียวกันหลังจากเริ่มงานไปแล้ว
    await db.prisma.serviceVariant.update({
      where: { id: serviceVariantId },
      data: { priceSatang: 99900, commissionSeniorSatang: 50000 },
    });

    await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "COMPLETED", paymentMethod: "CASH" });

    const jobAfterPriceChange = await db.prisma.serviceJob.findUnique({
      where: { appointmentItemId: item.id },
    });
    // ใบงานเก่าต้องไม่เปลี่ยนแม้แต่บาทเดียว แม้ ServiceVariant จะถูกแก้ไปแล้วก่อนจบงานก็ตาม
    expect(jobAfterPriceChange!.priceSatang).toBe(30000);
    expect(jobAfterPriceChange!.commissionSatang).toBe(12000);
  });

  it("snapshots a different commission rate for a JUNIOR-level staff on the same ServiceVariant", async () => {
    const db = await import("@lotus-desk/db");
    const juniorStaff = await db.prisma.staffProfile.create({
      data: { branchId, name: "พนักงานจูเนียร์", level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const start = new Date(Date.UTC(2026, 8, 11, 2, 0, 0));
    const item = await db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId: juniorStaff.id,
        roomId,
        serviceVariantId,
        status: "CHECKED_IN",
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });

    await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "IN_SERVICE" });

    const job = await db.prisma.serviceJob.findUnique({ where: { appointmentItemId: item.id } });
    expect(job!.staffLevelAtJob).toBe("JUNIOR");
    expect(job!.commissionSatang).toBe(10000);
  });

  it("completes an item that was set to IN_SERVICE directly (bypassing the endpoint, no ServiceJob exists) without a 500", async () => {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const start = new Date(Date.UTC(2026, 8, 12, 2, 0, 0));
    const item = await db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId,
        roomId,
        serviceVariantId,
        status: "IN_SERVICE",
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "COMPLETED", paymentMethod: "CASH" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
  });
});

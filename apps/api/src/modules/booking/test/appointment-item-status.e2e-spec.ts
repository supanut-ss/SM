import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/member/test/member-merge.e2e-spec.ts (T3.4)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T4.3: "เปลี่ยนสถานะผิดลำดับต้องได้ 422 พร้อมข้อความที่อ่านรู้เรื่อง" รวมถึงเส้นทาง
 * ปกติที่เปลี่ยนได้จริง กติกาลัด BOOKED → CHECKED_IN และสิทธิ์ (ต้องมี booking:manage)
 */
describe("Appointment item status transitions (real Postgres via Testcontainers)", () => {
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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "BOOKING-A" } });
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

    const managerEmail = "manager-booking-a@lotusdesk.local";
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
      data: { branchId, name: "พนักงานทดสอบ", level: "JUNIOR", skills: ["THAI_MASSAGE"] },
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

  // เวลาต้องไม่ซ้ำกันเลยข้ามการเรียกทุกครั้ง (staffId เดียวกันทุก item) ไม่งั้นจะชน EXCLUDE constraint
  // ของ T4.2 เอง (เจอมาแล้วจริงตอนเขียนเทสต์นี้ตอนใช้เวลาสุ่มจากช่วงแคบ ๆ — ยืนยันว่า constraint ทำงานถูก)
  let itemCounter = 0;

  async function createItem(status: "BOOKED" | "CONFIRMED" | "CHECKED_IN" | "IN_SERVICE" = "BOOKED") {
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
        status,
        startAt: start,
        endAt: end,
        roomCapacityAtBooking: 1,
      },
    });
  }

  it("เปลี่ยนสถานะตามลำดับปกติ (BOOKED → CONFIRMED) สำเร็จ", async () => {
    const item = await createItem("BOOKED");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CONFIRMED");
  });

  it("ลัดจาก BOOKED ไป CHECKED_IN ตรง ๆ ได้ (walk-in ไม่ต้องผ่านขั้นยืนยัน)", async () => {
    const item = await createItem("BOOKED");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "CHECKED_IN" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CHECKED_IN");
  });

  it("เปลี่ยนสถานะข้ามลำดับ (BOOKED → IN_SERVICE) ต้องได้ 422 พร้อมข้อความอ่านรู้เรื่อง", async () => {
    const item = await createItem("BOOKED");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "IN_SERVICE" });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("จองไว้");
    expect(res.body.message).toContain("กำลังบริการ");
  });

  it("ยกเลิกนัดหลังเช็คอินแล้วต้องได้ 422 (ยกเลิกได้เฉพาะก่อนเช็คอิน)", async () => {
    const item = await createItem("CHECKED_IN");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "CANCELLED" });
    expect(res.status).toBe(422);
  });

  it("เปลี่ยนสถานะของนัดที่เสร็จแล้ว (สถานะปลายทาง) ต้องได้ 422 เสมอ", async () => {
    const item = await createItem("IN_SERVICE");
    const completed = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "COMPLETED" });
    expect(completed.status).toBe(200);

    const again = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "IN_SERVICE" });
    expect(again.status).toBe(422);
  });

  it("ส่งสถานะที่ไม่มีอยู่จริงต้องได้ 400 จาก zod validation", async () => {
    const item = await createItem("BOOKED");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "SOMETHING_ELSE" });
    expect(res.status).toBe(400);
  });

  it("เปลี่ยนสถานะของ appointmentItemId ที่ไม่มีอยู่จริงต้องได้ 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/does-not-exist/status`)
      .set("Cookie", managerCookies)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(404);
  });

  it("บันทึก audit log ด้วย before/after สถานะที่ถูกต้อง", async () => {
    const item = await createItem("BOOKED");
    await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", managerCookies)
      .send({ status: "CONFIRMED" });

    const db = await import("@lotus-desk/db");
    const auditLog = await db.prisma.auditLog.findFirst({
      where: { entity: "AppointmentItem", entityId: item.id },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLog).not.toBeNull();
    expect((auditLog!.before as Record<string, unknown>).status).toBe("BOOKED");
    expect((auditLog!.after as Record<string, unknown>).status).toBe("CONFIRMED");
  });

  it("รับสิทธิ์ที่ไม่มี booking:manage ต้องได้ 403", async () => {
    const db = await import("@lotus-desk/db");
    const argon2 = await import("argon2");
    const viewOnlyRole = await db.prisma.role.create({ data: { key: "staff", name: "พนักงานบริการ" } });
    const viewPermission = await db.prisma.permission.findUnique({ where: { key: "booking:view" } });
    await db.prisma.rolePermission.create({
      data: { roleId: viewOnlyRole.id, permissionId: viewPermission!.id },
    });
    const staffEmail = "staff-booking-a@lotusdesk.local";
    const staffPassword = "ChangeMe123!";
    const staffUser = await db.prisma.user.create({
      data: {
        email: staffEmail,
        name: "พนักงานสาขา A (test)",
        passwordHash: await argon2.hash(staffPassword),
        isActive: true,
      },
    });
    await db.prisma.userBranch.create({
      data: { userId: staffUser.id, branchId, roleId: viewOnlyRole.id },
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: staffEmail, password: staffPassword });
    const staffCookies = login.headers["set-cookie"] as unknown as string[];

    const item = await createItem("BOOKED");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .set("Cookie", staffCookies)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(403);
  });

  it("รับสิทธิ์แบบไม่ได้ล็อกอินต้องได้ 401", async () => {
    const item = await createItem("BOOKED");
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/status`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(401);
  });
});

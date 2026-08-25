import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบการ list (T4.5 Lane Board ใช้ดึงข้อมูลวาดกระดาน) และ reschedule (ลากวาง/ย่อขยายบล็อก) รวมถึง
 * เกณฑ์ "ลากแล้วชนต้องเด้งกลับพร้อมบอกเหตุผล" — ยืนยันว่า EXCLUDE constraint จาก T4.2 ทำงานจริงผ่าน endpoint นี้
 */
describe("Appointment item list + reschedule (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let managerCookies: string[];
  let roomTypeId: string;
  let serviceVariantId: string;
  let staffAId: string;
  let staffBId: string;
  let noSkillStaffId: string;
  let roomAId: string;
  let roomBId: string;
  let wrongTypeRoomId: string;

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "RESCHED-A" } });
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

    const managerEmail = "manager-resched-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({ data: { userId: manager.id, branchId, roleId: managerRole.id } });

    const roomType = await prisma.roomType.create({ data: { branchId, name: "ห้องนวดไทย" } });
    roomTypeId = roomType.id;
    const otherRoomType = await prisma.roomType.create({ data: { branchId, name: "ห้องทำเล็บ" } });
    const roomA = await prisma.room.create({ data: { branchId, roomTypeId, name: "ห้อง A" } });
    roomAId = roomA.id;
    const roomB = await prisma.room.create({ data: { branchId, roomTypeId, name: "ห้อง B" } });
    roomBId = roomB.id;
    const wrongTypeRoom = await prisma.room.create({
      data: { branchId, roomTypeId: otherRoomType.id, name: "ห้อง C ผิดประเภท" },
    });
    wrongTypeRoomId = wrongTypeRoom.id;

    const staffA = await prisma.staffProfile.create({
      data: { branchId, name: "พนักงาน A", level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
    staffAId = staffA.id;
    const staffB = await prisma.staffProfile.create({
      data: { branchId, name: "พนักงาน B", level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
    staffBId = staffB.id;
    const noSkillStaff = await prisma.staffProfile.create({
      data: { branchId, name: "พนักงาน ไม่มีทักษะ", level: "JUNIOR", skills: ["NAIL"] },
    });
    noSkillStaffId = noSkillStaff.id;

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
        requiredRoomTypeId: roomTypeId,
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

  async function createItem(staffId: string, roomId: string) {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const start = new Date(Date.UTC(2026, 8, 20, 2, 0, 0) + itemCounter * 90 * 60_000);
    itemCounter += 1;
    return db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId,
        roomId,
        serviceVariantId,
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });
  }

  it("แสดงรายการนัดของวันที่ระบุ พร้อม staff/room/serviceVariant/appointment join มาด้วย", async () => {
    const item = await createItem(staffAId, roomAId);
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchId}/appointment-items?date=2026-09-20`)
      .set("Cookie", managerCookies);
    expect(res.status).toBe(200);
    const found = (res.body as Array<{ id: string; staff: { name: string }; room: { name: string } }>).find(
      (i) => i.id === item.id,
    );
    expect(found).toBeDefined();
    expect(found!.staff.name).toBe("พนักงาน A");
    expect(found!.room.name).toBe("ห้อง A");
  });

  it("ย้ายนัดไปพนักงาน/ห้อง/เวลาใหม่ที่ว่างได้สำเร็จ", async () => {
    const item = await createItem(staffAId, roomAId);
    const newStart = new Date(Date.UTC(2026, 8, 20, 8, 0, 0));
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/reschedule`)
      .set("Cookie", managerCookies)
      .send({
        staffId: staffBId,
        roomId: roomBId,
        startAt: newStart.toISOString(),
        endAt: new Date(newStart.getTime() + 60 * 60_000).toISOString(),
      });
    expect(res.status).toBe(200);
    expect(res.body.staffId).toBe(staffBId);
    expect(res.body.roomId).toBe(roomBId);
  });

  it("ลากไปชนนัดอื่นของพนักงานเดียวกันต้องได้ 409 พร้อมข้อความอ่านรู้เรื่อง (ไม่ใช่ error ดิบจาก Postgres)", async () => {
    const fixedStart = new Date(Date.UTC(2026, 8, 20, 9, 0, 0));
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    // นัดที่จะ "ชน" — สร้างตรงด้วย Prisma แทน helper createItem เพราะต้องคุมเวลาให้ตรงเป๊ะกับที่จะลากไป
    await db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId: staffAId,
        roomId: roomAId,
        serviceVariantId,
        startAt: fixedStart,
        endAt: new Date(fixedStart.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });
    const toMove = await createItem(staffBId, roomBId);

    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${toMove.id}/reschedule`)
      .set("Cookie", managerCookies)
      .send({
        staffId: staffAId,
        roomId: roomBId,
        startAt: fixedStart.toISOString(),
        endAt: new Date(fixedStart.getTime() + 60 * 60_000).toISOString(),
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("ชนกับนัดอื่น");
  });

  it("ย้ายไปหาพนักงานที่ไม่มีทักษะที่บริการต้องใช้ ต้องได้ 422", async () => {
    const item = await createItem(staffAId, roomAId);
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/reschedule`)
      .set("Cookie", managerCookies)
      .send({
        staffId: noSkillStaffId,
        roomId: roomAId,
        startAt: new Date(Date.UTC(2026, 8, 20, 11, 0, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 8, 20, 12, 0, 0)).toISOString(),
      });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("ทักษะ");
  });

  it("ย้ายไปห้องผิดประเภท ต้องได้ 422", async () => {
    const item = await createItem(staffAId, roomAId);
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${item.id}/reschedule`)
      .set("Cookie", managerCookies)
      .send({
        staffId: staffAId,
        roomId: wrongTypeRoomId,
        startAt: new Date(Date.UTC(2026, 8, 20, 13, 0, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 8, 20, 14, 0, 0)).toISOString(),
      });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("ประเภทห้อง");
  });

  it("ย้ายนัดที่ไม่มีอยู่จริงต้องได้ 404", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/does-not-exist/reschedule`)
      .set("Cookie", managerCookies)
      .send({
        staffId: staffAId,
        roomId: roomAId,
        startAt: new Date(Date.UTC(2026, 8, 20, 15, 0, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 8, 20, 16, 0, 0)).toISOString(),
      });
    expect(res.status).toBe(404);
  });
});

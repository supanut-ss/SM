import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T4.7 "จองล่วงหน้า": สร้างนัดได้ด้วยพนักงาน/ห้อง/เวลาที่เลือกเอง (assignType
 * CUSTOMER_REQUEST, สถานะเริ่มต้น BOOKED), ปฏิเสธเวลาที่เกิน 7 วันข้างหน้าหรือเป็นอดีต, ปฏิเสธพนักงานที่ไม่มี
 * ทักษะ/ห้องผิดประเภท, ปฏิเสธเวลาที่ชนกับนัดเดิมของพนักงาน/ห้องเดียวกัน (DB exclusion constraint)
 */
describe("Advance booking (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let managerCookies: string[];
  let roomTypeId: string;

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "ADVANCE-A" } });
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

    const managerEmail = "manager-advance-a@lotusdesk.local";
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

    const roomType = await prisma.roomType.create({ data: { branchId, name: "ห้องนวดเดี่ยว" } });
    roomTypeId = roomType.id;

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

  async function createStaff(name: string, skills: ("THAI_MASSAGE" | "NAIL")[] = ["THAI_MASSAGE"]) {
    const db = await import("@lotus-desk/db");
    return db.prisma.staffProfile.create({ data: { branchId, name, level: "JUNIOR", skills } });
  }

  async function createServiceVariant(durationMin: number, requiredRoomTypeId = roomTypeId) {
    const db = await import("@lotus-desk/db");
    const category = await db.prisma.serviceCategory.create({
      data: { branchId, name: `หมวด-${Date.now()}-${Math.random()}` },
    });
    const service = await db.prisma.service.create({
      data: { branchId, categoryId: category.id, name: `บริการ-${Date.now()}-${Math.random()}` },
    });
    return db.prisma.serviceVariant.create({
      data: {
        serviceId: service.id,
        durationMin,
        priceSatang: 30000,
        commissionJuniorSatang: 10000,
        commissionSeniorSatang: 12000,
        commissionMasterSatang: 15000,
        requiredSkill: "THAI_MASSAGE",
        requiredRoomTypeId,
      },
    });
  }

  async function createRoom(name: string, forRoomTypeId = roomTypeId) {
    const db = await import("@lotus-desk/db");
    return db.prisma.room.create({ data: { branchId, roomTypeId: forRoomTypeId, name } });
  }

  function inDays(days: number, hour = 10): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  it("จองล่วงหน้าสำเร็จ: สร้างนัดสถานะ BOOKED ด้วยพนักงาน/ห้อง/เวลาที่เลือกเอง", async () => {
    const staff = await createStaff("พนักงานจองล่วงหน้า 1");
    const room = await createRoom("ห้องจองล่วงหน้า 1");
    const variant = await createServiceVariant(60);
    const startAt = inDays(2);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id, staffId: staff.id, roomId: room.id, startAt: startAt.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.staffId).toBe(staff.id);
    expect(res.body.roomId).toBe(room.id);
    expect(res.body.status).toBe("BOOKED");
    expect(res.body.assignType).toBe("CUSTOMER_REQUEST");
  });

  it("เวลาเกิน 7 วันข้างหน้า ต้องได้ 400", async () => {
    const staff = await createStaff("พนักงานเกิน 7 วัน");
    const room = await createRoom("ห้องเกิน 7 วัน");
    const variant = await createServiceVariant(60);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({
        serviceVariantId: variant.id,
        staffId: staff.id,
        roomId: room.id,
        startAt: inDays(8).toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it("เวลาเป็นอดีต ต้องได้ 400", async () => {
    const staff = await createStaff("พนักงานเวลาอดีต");
    const room = await createRoom("ห้องเวลาอดีต");
    const variant = await createServiceVariant(60);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({
        serviceVariantId: variant.id,
        staffId: staff.id,
        roomId: room.id,
        startAt: inDays(-1).toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it("พนักงานไม่มีทักษะที่ต้องใช้ ต้องได้ 422", async () => {
    const staff = await createStaff("พนักงานไม่มีทักษะ", ["NAIL"]);
    const room = await createRoom("ห้องไม่มีทักษะ");
    const variant = await createServiceVariant(60);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({
        serviceVariantId: variant.id,
        staffId: staff.id,
        roomId: room.id,
        startAt: inDays(2).toISOString(),
      });

    expect(res.status).toBe(422);
  });

  it("ห้องผิดประเภท ต้องได้ 422", async () => {
    const staff = await createStaff("พนักงานห้องผิดประเภท");
    const otherRoomType = await (await import("@lotus-desk/db")).prisma.roomType.create({
      data: { branchId, name: "ประเภทห้องอื่น" },
    });
    const room = await createRoom("ห้องผิดประเภท", otherRoomType.id);
    const variant = await createServiceVariant(60);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({
        serviceVariantId: variant.id,
        staffId: staff.id,
        roomId: room.id,
        startAt: inDays(2).toISOString(),
      });

    expect(res.status).toBe(422);
  });

  it("เวลาชนกับนัดเดิมของพนักงานคนเดียวกัน ต้องได้ 409", async () => {
    const staff = await createStaff("พนักงานชนเวลา");
    const roomA = await createRoom("ห้องชนเวลา A");
    const roomB = await createRoom("ห้องชนเวลา B");
    const variant = await createServiceVariant(60);
    const startAt = inDays(3);

    const first = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id, staffId: staff.id, roomId: roomA.id, startAt: startAt.toISOString() });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/advance`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id, staffId: staff.id, roomId: roomB.id, startAt: startAt.toISOString() });

    expect(second.status).toBe(409);
  });
});

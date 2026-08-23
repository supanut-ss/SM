import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { toBangkokDateOnly } from "../bangkok-date";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T4.6: "จองด่วนจากคิวหมุน" เลือกพนักงาน+ห้องให้เอง, เช็คอินทันที (สถานะ CHECKED_IN),
 * เลือกคนหัวคิวก่อนเมื่อมีหลายคนว่างพร้อมกัน, ปฏิเสธเมื่อไม่มีใครว่าง/ไม่มีห้องรองรับ
 */
describe("Walk-in quick booking (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let managerCookies: string[];
  let roomTypeId: string;
  const todayLabel = toBangkokDateOnly(new Date());

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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "WALKIN-A" } });
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

    const managerEmail = "manager-walkin-a@lotusdesk.local";
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

  async function createStaff(name: string) {
    const db = await import("@lotus-desk/db");
    return db.prisma.staffProfile.create({
      data: { branchId, name, level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
  }

  /** กะเต็มวัน (00:00-23:59) กัน flaky จากเวลาจริงตอนรันเทสต์ — "ตอนนี้" อยู่ในกะเสมอ */
  async function giveFullDayShift(staffId: string) {
    const db = await import("@lotus-desk/db");
    const template = await db.prisma.shiftTemplate.create({
      data: { branchId, name: `เต็มวัน-${staffId}`, startMin: 0, endMin: 1439 },
    });
    await db.prisma.staffShift.create({
      data: { branchId, staffId, shiftTemplateId: template.id, date: todayLabel, startMin: 0, endMin: 1439 },
    });
  }

  async function createServiceVariant(durationMin: number, skill: "THAI_MASSAGE" = "THAI_MASSAGE") {
    const db = await import("@lotus-desk/db");
    const category = await db.prisma.serviceCategory.create({ data: { branchId, name: `หมวด-${Date.now()}-${Math.random()}` } });
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
        requiredSkill: skill,
        requiredRoomTypeId: roomTypeId,
      },
    });
  }

  async function createRoom(name: string) {
    const db = await import("@lotus-desk/db");
    return db.prisma.room.create({ data: { branchId, roomTypeId, name } });
  }

  async function joinQueue(staffId: string) {
    return request(app.getHttpServer())
      .post(`/branches/${branchId}/staff-queue/join`)
      .set("Cookie", managerCookies)
      .send({ staffId });
  }

  it("จองด่วนสำเร็จ: เลือกพนักงานที่มีทักษะ+ห้องว่าง สร้างนัดสถานะเช็คอินแล้วทันที", async () => {
    const staff = await createStaff("พนักงานจองด่วน 1");
    await giveFullDayShift(staff.id);
    await createRoom("ห้อง จองด่วน 1");
    const variant = await createServiceVariant(60);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/walk-in`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id });

    expect(res.status).toBe(201);
    expect(res.body.staffId).toBe(staff.id);
    expect(res.body.status).toBe("CHECKED_IN");
    expect(res.body.assignType).toBe("ROTATION");
    expect(res.body.appointment.memberId).toBeNull();
  });

  it("มีพนักงานว่างหลายคน ต้องเลือกคนที่อยู่หัวคิวหมุนก่อน", async () => {
    const staffA = await createStaff("พนักงานคิว A");
    const staffB = await createStaff("พนักงานคิว B");
    await giveFullDayShift(staffA.id);
    await giveFullDayShift(staffB.id);
    await createRoom("ห้องคิว 1");
    await createRoom("ห้องคิว 2");
    const variant = await createServiceVariant(60);

    // B เข้าคิวก่อน A — B ต้องอยู่หัวคิว
    await joinQueue(staffB.id);
    await joinQueue(staffA.id);

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/walk-in`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id });

    expect(res.status).toBe(201);
    expect(res.body.staffId).toBe(staffB.id);
  });

  it("ไม่มีพนักงานคนไหนมีทักษะที่ต้องใช้เลย ต้องได้ 422", async () => {
    const db = await import("@lotus-desk/db");
    const cat = await db.prisma.serviceCategory.create({ data: { branchId, name: "หมวดไม่มีคนทำ" } });
    const service = await db.prisma.service.create({ data: { branchId, categoryId: cat.id, name: "บริการไม่มีคนทำ" } });
    const variant = await db.prisma.serviceVariant.create({
      data: {
        serviceId: service.id,
        durationMin: 60,
        priceSatang: 30000,
        commissionJuniorSatang: 10000,
        commissionSeniorSatang: 12000,
        commissionMasterSatang: 15000,
        requiredSkill: "NAIL",
        requiredRoomTypeId: roomTypeId,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/walk-in`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id });

    expect(res.status).toBe(422);
  });

  it("ไม่มีห้องรองรับประเภทที่ต้องใช้เลย ต้องได้ 422", async () => {
    const db = await import("@lotus-desk/db");
    const emptyRoomType = await db.prisma.roomType.create({ data: { branchId, name: "ประเภทไม่มีห้อง" } });
    const category = await db.prisma.serviceCategory.create({ data: { branchId, name: "หมวดไม่มีห้อง" } });
    const service = await db.prisma.service.create({ data: { branchId, categoryId: category.id, name: "บริการไม่มีห้อง" } });
    const variant = await db.prisma.serviceVariant.create({
      data: {
        serviceId: service.id,
        durationMin: 60,
        priceSatang: 30000,
        commissionJuniorSatang: 10000,
        commissionSeniorSatang: 12000,
        commissionMasterSatang: 15000,
        requiredSkill: "THAI_MASSAGE",
        requiredRoomTypeId: emptyRoomType.id,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/walk-in`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: variant.id });

    expect(res.status).toBe(422);
  });

  it("บริการที่ไม่มีอยู่จริงต้องได้ 404", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchId}/appointment-items/walk-in`)
      .set("Cookie", managerCookies)
      .send({ serviceVariantId: "does-not-exist" });
    expect(res.status).toBe(404);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T4.4: "test ครบทั้งสองการตั้งค่า" (customRequestKeepsQueuePosition true/false) รวมถึง
 * เข้าคิว, จบงานคิวหมุนเสียตำแหน่งเสมอ, และยกเลิก/ไม่มา กลับหัวคิว (docs/DOMAIN.md ข้อ 1-3)
 */
describe("Staff rotation queue (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchId: string;
  let managerCookies: string[];
  let roomId: string;
  let roomTypeId: string;
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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "QUEUE-A" } });
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

    const managerEmail = "manager-queue-a@lotusdesk.local";
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
    const room = await prisma.room.create({ data: { branchId, roomTypeId, name: "ห้อง 1" } });
    roomId = room.id;
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

  // แต่ละ it() ต้องใช้วันของตัวเองไม่ซ้ำกันเลย ไม่งั้นคิวของแต่ละเทสต์จะปนกัน (StaffQueueEntry
  // ผูกกับ branchId+date เดียวกันหมดถ้าใช้วันเดียวกัน) — เดือนกันยายนมี 30 วัน พอสำหรับทุกเทสต์ในไฟล์นี้
  let dayOffset = 0;
  function nextDate(): string {
    dayOffset += 1;
    return `2026-09-${String(dayOffset).padStart(2, "0")}`;
  }

  async function createStaff(name: string) {
    const db = await import("@lotus-desk/db");
    return db.prisma.staffProfile.create({
      data: { branchId, name, level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
  }

  async function joinQueue(staffId: string, date: string) {
    return request(app.getHttpServer())
      .post(`/branches/${branchId}/staff-queue/join`)
      .set("Cookie", managerCookies)
      .send({ staffId, date });
  }

  async function getQueue(date: string) {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchId}/staff-queue?date=${date}`)
      .set("Cookie", managerCookies);
    return (res.body as Array<{ staffId: string; position: number }>)
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((e) => e.staffId);
  }

  let itemCounter = 0;

  // startAt ต้องตกวันเดียวกับ date ที่ใช้ join คิว (StaffQueueEntry.date มาจาก toBangkokDateOnly(startAt)
  // ตอน complete/cancel ไม่ใช่จากพารามิเตอร์ตรง ๆ — ดู AppointmentItemController.applyQueueEffect)
  async function createBookedItem(staffId: string, assignType: "ROTATION" | "CUSTOMER_REQUEST", date: string) {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const [y, m, d] = date.split("-").map(Number);
    // 09:00 เวลาไทย = 02:00 UTC ของวันเดียวกัน
    const start = new Date(Date.UTC(y!, m! - 1, d!, 2, 0, 0) + itemCounter * 90 * 60_000);
    itemCounter += 1;
    return db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId,
        roomId,
        serviceVariantId,
        assignType,
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });
  }

  async function setStatus(itemId: string, status: string) {
    // IN_SERVICE ต้องมีแหล่งชำระเสมอตั้งแต่ ADR-046 (ตัดสินใจตอนเริ่มงาน ไม่ใช่ตอนจบงานอีกต่อไป — พลิกกลับ
    // ADR-029 ข้อ 4) — ใส่ค่าเริ่มต้นให้เทสต์คิวหมุนเหล่านี้ที่ไม่ได้สนใจเรื่องแหล่งชำระโดยตรง
    const body = status === "IN_SERVICE" ? { status, paymentMethod: "CASH" } : { status };
    return request(app.getHttpServer())
      .patch(`/branches/${branchId}/appointment-items/${itemId}/status`)
      .set("Cookie", managerCookies)
      .send(body);
  }

  it("เข้าคิวได้ตามลำดับที่กด (เรียงตามเวลามาถึง) และเข้าซ้ำไม่เปลี่ยนตำแหน่ง", async () => {
    const date = nextDate();
    const a = await createStaff("A เข้าคิว");
    const b = await createStaff("B เข้าคิว");
    const c = await createStaff("C เข้าคิว");

    await joinQueue(a.id, date);
    await joinQueue(b.id, date);
    await joinQueue(c.id, date);
    expect(await getQueue(date)).toEqual([a.id, b.id, c.id]);

    // เข้าซ้ำ (idempotent) ไม่ต้องเปลี่ยนตำแหน่ง
    const res = await joinQueue(a.id, date);
    expect(res.status).toBe(201);
    expect(await getQueue(date)).toEqual([a.id, b.id, c.id]);
  });

  it("จบงานคิวหมุน (ROTATION) เสียตำแหน่งเสมอ — ต่อท้ายคิว", async () => {
    const date = nextDate();
    const a = await createStaff("A รอบตัด");
    const b = await createStaff("B รอบตัด");
    await joinQueue(a.id, date);
    await joinQueue(b.id, date);
    expect(await getQueue(date)).toEqual([a.id, b.id]);

    const item = await createBookedItem(a.id, "ROTATION", date);
    await setStatus(item.id, "CHECKED_IN");
    await setStatus(item.id, "IN_SERVICE");
    const done = await setStatus(item.id, "COMPLETED");
    expect(done.status).toBe(200);

    expect(await getQueue(date)).toEqual([b.id, a.id]);
  });

  it("จบงานลูกค้าขอ (CUSTOMER_REQUEST) เสียตำแหน่งเมื่อ customRequestKeepsQueuePosition = false (ค่าเริ่มต้น)", async () => {
    const date = nextDate();
    const a = await createStaff("A ลูกค้าขอ-เสีย");
    const b = await createStaff("B ลูกค้าขอ-เสีย");
    await joinQueue(a.id, date);
    await joinQueue(b.id, date);
    expect(await getQueue(date)).toEqual([a.id, b.id]);

    const item = await createBookedItem(a.id, "CUSTOMER_REQUEST", date);
    await setStatus(item.id, "CHECKED_IN");
    await setStatus(item.id, "IN_SERVICE");
    await setStatus(item.id, "COMPLETED");

    expect(await getQueue(date)).toEqual([b.id, a.id]);
  });

  it("จบงานลูกค้าขอ (CUSTOMER_REQUEST) ไม่เสียตำแหน่งเมื่อ customRequestKeepsQueuePosition = true", async () => {
    const date = nextDate();
    const db = await import("@lotus-desk/db");
    await db.prisma.branch.update({
      where: { id: branchId },
      data: { customRequestKeepsQueuePosition: true },
    });

    const a = await createStaff("A ลูกค้าขอ-ไม่เสีย");
    const b = await createStaff("B ลูกค้าขอ-ไม่เสีย");
    await joinQueue(a.id, date);
    await joinQueue(b.id, date);
    expect(await getQueue(date)).toEqual([a.id, b.id]);

    const item = await createBookedItem(a.id, "CUSTOMER_REQUEST", date);
    await setStatus(item.id, "CHECKED_IN");
    await setStatus(item.id, "IN_SERVICE");
    await setStatus(item.id, "COMPLETED");

    // ยังอยู่หัวคิวเหมือนเดิม ไม่ถูกย้ายไปท้าย
    expect(await getQueue(date)).toEqual([a.id, b.id]);

    await db.prisma.branch.update({
      where: { id: branchId },
      data: { customRequestKeepsQueuePosition: false },
    });
  });

  it("แม้เป็นงานคิวหมุน ก็ยังเสียตำแหน่งเสมอไม่ว่าจะตั้งค่า customRequestKeepsQueuePosition อย่างไร", async () => {
    const date = nextDate();
    const db = await import("@lotus-desk/db");
    await db.prisma.branch.update({
      where: { id: branchId },
      data: { customRequestKeepsQueuePosition: true },
    });

    const a = await createStaff("A คิวหมุน-ไม่ยกเว้น");
    const b = await createStaff("B คิวหมุน-ไม่ยกเว้น");
    await joinQueue(a.id, date);
    await joinQueue(b.id, date);

    const item = await createBookedItem(a.id, "ROTATION", date);
    await setStatus(item.id, "CHECKED_IN");
    await setStatus(item.id, "IN_SERVICE");
    await setStatus(item.id, "COMPLETED");

    expect(await getQueue(date)).toEqual([b.id, a.id]);

    await db.prisma.branch.update({
      where: { id: branchId },
      data: { customRequestKeepsQueuePosition: false },
    });
  });

  it("ยกเลิกนัดกะทันหัน (CANCELLED) พนักงานกลับไปหัวคิว ไม่ใช่ความผิดพนักงาน", async () => {
    const date = nextDate();
    const a = await createStaff("A ยกเลิก");
    const b = await createStaff("B ยกเลิก");
    const c = await createStaff("C ยกเลิก");
    await joinQueue(a.id, date);
    await joinQueue(b.id, date);
    await joinQueue(c.id, date);
    expect(await getQueue(date)).toEqual([a.id, b.id, c.id]);

    const item = await createBookedItem(c.id, "ROTATION", date);
    const cancelled = await setStatus(item.id, "CANCELLED");
    expect(cancelled.status).toBe(200);

    expect(await getQueue(date)).toEqual([c.id, a.id, b.id]);
  });

  it("ลูกค้าไม่มา (NO_SHOW) พนักงานกลับไปหัวคิวเช่นกัน", async () => {
    const date = nextDate();
    const a = await createStaff("A ไม่มา");
    const b = await createStaff("B ไม่มา");
    await joinQueue(a.id, date);
    await joinQueue(b.id, date);
    expect(await getQueue(date)).toEqual([a.id, b.id]);

    const item = await createBookedItem(b.id, "ROTATION", date);
    const noShow = await setStatus(item.id, "NO_SHOW");
    expect(noShow.status).toBe(200);

    expect(await getQueue(date)).toEqual([b.id, a.id]);
  });

  it("จบงานของพนักงานที่ยังไม่เคยเข้าคิวมาก่อน ยังคงเข้าคิว (ท้ายสุด) ได้ตามปกติ", async () => {
    const date = nextDate();
    const a = await createStaff("A ไม่เคยเข้าคิว");
    const item = await createBookedItem(a.id, "ROTATION", date);
    await setStatus(item.id, "CHECKED_IN");
    await setStatus(item.id, "IN_SERVICE");
    await setStatus(item.id, "COMPLETED");

    const entries = await getQueue(date);
    expect(entries).toContain(a.id);
  });

  it("เข้าคิวด้วยพนักงานที่ไม่มีอยู่จริงในสาขานี้ต้องได้ 404", async () => {
    const res = await joinQueue("does-not-exist", nextDate());
    expect(res.status).toBe(404);
  });
});

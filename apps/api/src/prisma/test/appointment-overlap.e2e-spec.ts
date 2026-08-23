import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1 — pattern Testcontainers เดียวกับ e2e spec อื่น ๆ
 * แต่ไม่ต้องมี NestJS app เลย เพราะ T4.2 ทดสอบแค่ schema + EXCLUDE constraint ระดับ Postgres ตรง ๆ
 * (ยังไม่มี booking module/endpoint จริง — รอ Task ถัดไป) ยิง Prisma เข้า DB จริงตรง ๆ
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T4.2: "ยิงจองพร้อมกัน 50 request ช่องเดียวกัน ต้องสำเร็จ 1 เท่านั้น" ทั้งฝั่งพนักงาน
 * และฝั่งห้อง (capacity=1) — ดู docs/decisions.md ADR-020 สำหรับเหตุผลการออกแบบ constraint
 */
describe("Appointment overlap protection (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: import("@lotus-desk/db").PrismaClient;
  let branchId: string;
  let roomTypeId: string;
  let serviceVariantId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    process.env.APP_DATABASE_URL = databaseUrl;

    execSync("npx prisma migrate deploy", {
      cwd: "../../packages/db",
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });

    const db = await import("@lotus-desk/db");
    prisma = db.prisma;

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "APPT-A" } });
    branchId = branch.id;

    const roomType = await prisma.roomType.create({ data: { branchId, name: "ห้องนวดไทย" } });
    roomTypeId = roomType.id;

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
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  async function createStaff(name: string) {
    return prisma.staffProfile.create({
      data: { branchId, name, level: "JUNIOR", skills: ["THAI_MASSAGE"] },
    });
  }

  async function createRoom(name: string, capacity = 1) {
    return prisma.room.create({ data: { branchId, roomTypeId, name, capacity } });
  }

  /** appointmentId ต้องมีจริงก่อนเสมอ (FK) — สร้าง N รายการล่วงหน้าให้แต่ละ concurrent request ใช้คนละอัน */
  async function createAppointments(count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const a = await prisma.appointment.create({ data: { branchId } });
      ids.push(a.id);
    }
    return ids;
  }

  function tryBook(appointmentId: string, staffId: string, roomId: string, start: Date, end: Date) {
    return prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId,
        staffId,
        roomId,
        serviceVariantId,
        startAt: start,
        endAt: end,
        roomCapacityAtBooking: 1,
      },
    });
  }

  it("ยิงจองพร้อมกัน 50 request ช่วงเวลาเดียวกันของพนักงานคนเดียวกัน ต้องสำเร็จแค่ 1 รายการ", async () => {
    const staff = await createStaff("พนักงานทดสอบ 1");
    const appointmentIds = await createAppointments(50);
    const start = new Date("2026-09-01T02:00:00.000Z");
    const end = new Date("2026-09-01T03:00:00.000Z");

    // ห้องต่างกันทุกครั้งเพื่อแยกผลจาก room constraint — เหลือแค่ staff constraint ที่ทดสอบตรงนี้
    const rooms = await Promise.all(
      appointmentIds.map((_, i) => createRoom(`ห้องพนักงาน1-${i}`)),
    );

    const results = await Promise.allSettled(
      appointmentIds.map((id, i) => tryBook(id, staff.id, rooms[i]!.id, start, end)),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(49);

    const stillBooked = await prisma.appointmentItem.count({
      where: { staffId: staff.id, startAt: start, endAt: end },
    });
    expect(stillBooked).toBe(1);
  });

  it("ยิงจองพร้อมกัน 50 request ช่วงเวลาเดียวกันของห้องเดียวกัน (capacity=1) ต้องสำเร็จแค่ 1 รายการ", async () => {
    const room = await createRoom("ห้อง capacity 1");
    const appointmentIds = await createAppointments(50);
    const start = new Date("2026-09-02T02:00:00.000Z");
    const end = new Date("2026-09-02T03:00:00.000Z");

    // พนักงานต่างกันทุกครั้งเพื่อแยกผลจาก staff constraint — เหลือแค่ room constraint ที่ทดสอบตรงนี้
    const staffList = await Promise.all(
      appointmentIds.map((_, i) => createStaff(`พนักงานห้อง-${i}`)),
    );

    const results = await Promise.allSettled(
      appointmentIds.map((id, i) => tryBook(id, staffList[i]!.id, room.id, start, end)),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(49);
  });

  it("นัดที่ถูกยกเลิก (CANCELLED) ต้องไม่บล็อกช่องเดิมอีกต่อไป", async () => {
    const staff = await createStaff("พนักงานทดสอบ 2");
    const room = await createRoom("ห้อง 2");
    const [firstId, secondId] = await createAppointments(2);
    const start = new Date("2026-09-03T02:00:00.000Z");
    const end = new Date("2026-09-03T03:00:00.000Z");

    const first = await tryBook(firstId!, staff.id, room.id, start, end);
    await prisma.appointmentItem.update({ where: { id: first.id }, data: { status: "CANCELLED" } });

    // จองซ้ำที่ช่องเดิมพอดี ต้องผ่านได้เพราะรายการเดิมถูกยกเลิกไปแล้ว
    await expect(tryBook(secondId!, staff.id, room.id, start, end)).resolves.toBeDefined();
  });

  it("ห้อง capacity มากกว่า 1 ไม่ถูกกันโดย EXCLUDE constraint ระดับ DB (ตั้งใจ — ดู ADR-020)", async () => {
    const room = await createRoom("ห้อง capacity 2", 2);
    const staffA = await createStaff("พนักงานห้อง2-A");
    const staffB = await createStaff("พนักงานห้อง2-B");
    const [idA, idB] = await createAppointments(2);
    const start = new Date("2026-09-04T02:00:00.000Z");
    const end = new Date("2026-09-04T03:00:00.000Z");

    const itemA = await prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: idA!,
        staffId: staffA.id,
        roomId: room.id,
        serviceVariantId,
        startAt: start,
        endAt: end,
        roomCapacityAtBooking: 2,
      },
    });
    const itemB = await prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: idB!,
        staffId: staffB.id,
        roomId: room.id,
        serviceVariantId,
        startAt: start,
        endAt: end,
        roomCapacityAtBooking: 2,
      },
    });
    expect(itemA.id).not.toBe(itemB.id);
  });
});

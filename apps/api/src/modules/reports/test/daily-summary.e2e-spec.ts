import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
// type-only — ต้อง "ห้าม" import ค่าจริง (value) ของ DailySummaryService ตรง ๆ ที่ระดับบนสุดของไฟล์
// เพราะมันจะลาก PrismaService -> @lotus-desk/db ให้ evaluate (และ cache globalThis.__prisma จาก
// DATABASE_URL ใน .env จริง) ตั้งแต่ตอน import ไฟล์นี้ ก่อนที่ beforeAll จะทัน set env ชี้ไปที่
// Testcontainers เสียอีก — ต้อง dynamic import ค่าจริงข้างใน beforeAll เท่านั้น (ตามแบบแผนเดียวกับที่
// payroll/attendance e2e spec dynamic import "../../../main" แทนที่จะ import ตรง ๆ)
import type { DailySummaryService as DailySummaryServiceType } from "../daily-summary.service";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers (Postgres จริง) — ไม่มี HTTP controller
 * ในโมดูลนี้ (T7.1 ไม่มี endpoint, T7.2 ค่อยเพิ่ม) จึงไม่ใช้ supertest เลย: ดึง DailySummaryService ออกจาก
 * Nest application context โดยตรงแล้วเรียก computeAndUpsertForBranchAndDate ตรง ๆ จากนั้นอ่านผลผ่าน Prisma
 *
 * ครอบเกณฑ์ผ่านของ T7.1: คำนวณรายได้/เงินเข้า/ช่องทางชำระ (ไม่นับบิลที่ยกเลิก), ยอดขาย/ใช้คอร์ส,
 * ลูกค้าใหม่/เก่า, no-show, สรุปต่อพนักงาน (กะ/ใบงานที่จบ ไม่นับใบงานที่ถูกยกเลิก), และ idempotency
 * (รันซ้ำ 3 ครั้งได้ผลเท่าเดิม)
 */
describe("DailySummaryService (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplicationContext;
  let dailySummaryService: DailySummaryServiceType;
  let branchId: string;
  let roomTypeId: string;
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

    const branch = await prisma.branch.create({ data: { name: "สาขา A", code: "REPORTS-A" } });
    branchId = branch.id;

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
        requiredRoomTypeId: roomTypeId,
      },
    });
    serviceVariantId = variant.id;

    const { AppModule } = await import("../../../app.module");
    const { DailySummaryService } = await import("../daily-summary.service");
    app = await NestFactory.createApplicationContext(AppModule);
    dailySummaryService = app.get(DailySummaryService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  /** 10:00 น. เวลาไทยของวันที่กำหนด (แปลงเป็น UTC instant) — อยู่กลางวันปฏิทินไทยแน่นอน ไม่ชนขอบเขตวัน */
  function bangkokInstant(y: number, m: number, d: number, hh = 10, mm = 0): Date {
    return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0));
  }

  /** เที่ยงคืน UTC ของวันที่กำหนด — ใช้เป็น "วันปฏิทินไทย" ที่ส่งเข้า computeAndUpsertForBranchAndDate
   * (ตัวบริการเองแปลงให้ตรงวันไทยอีกที ผ่าน toBangkokDateOnly — ดู bangkok-time.ts) */
  function bangkokDateArg(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m - 1, d));
  }

  let memberCounter = 0;
  async function createMember() {
    memberCounter += 1;
    const db = await import("@lotus-desk/db");
    return db.prisma.member.create({
      data: { branchId, code: `M${memberCounter}`, name: `สมาชิกทดสอบ ${memberCounter}`, phone: `080000${1000 + memberCounter}` },
    });
  }

  let staffCounter = 0;
  async function createStaff() {
    staffCounter += 1;
    const db = await import("@lotus-desk/db");
    return db.prisma.staffProfile.create({
      data: { branchId, name: `พนักงานทดสอบ ${staffCounter}`, level: "SENIOR", skills: ["THAI_MASSAGE"] },
    });
  }

  /** สร้าง AppointmentItem + ServiceJob ตรงจาก Prisma (ไม่ผ่าน HTTP เพราะโมดูลนี้ไม่มี controller ให้ทดสอบ) */
  async function createCompletedServiceJob(opts: {
    staffId: string;
    startedAt: Date;
    completedAt: Date;
    commissionSatang: number;
    voidedAt?: Date | null;
  }) {
    const db = await import("@lotus-desk/db");
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const item = await db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId: opts.staffId,
        roomId,
        serviceVariantId,
        status: "COMPLETED",
        startAt: opts.startedAt,
        endAt: opts.completedAt,
        roomCapacityAtBooking: 1,
      },
    });
    return db.prisma.serviceJob.create({
      data: {
        branchId,
        appointmentItemId: item.id,
        staffId: opts.staffId,
        roomId,
        serviceVariantId,
        assignType: "ROTATION",
        priceSatang: 30000,
        staffLevelAtJob: "SENIOR",
        commissionSatang: opts.commissionSatang,
        startedAt: opts.startedAt,
        completedAt: opts.completedAt,
        paymentMethod: "CASH",
        voidedAt: opts.voidedAt ?? null,
      },
    });
  }

  let billCounter = 0;
  async function createBill(opts: {
    createdAt: Date;
    totalSatang: number;
    status?: "PAID" | "CANCELLED";
    memberId?: string;
    cashAmountSatang?: number;
  }) {
    billCounter += 1;
    const db = await import("@lotus-desk/db");
    return db.prisma.bill.create({
      data: {
        branchId,
        memberId: opts.memberId ?? null,
        billNumber: `B${String(billCounter).padStart(6, "0")}`,
        subtotalSatang: opts.totalSatang,
        totalSatang: opts.totalSatang,
        status: opts.status ?? "PAID",
        createdAt: opts.createdAt,
        payments:
          opts.cashAmountSatang !== undefined
            ? { create: [{ branchId, method: "CASH", amountSatang: opts.cashAmountSatang }] }
            : undefined,
      },
    });
  }

  it("computes recognized revenue and cash payments from bills, excluding a cancelled bill", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 10);

    await createBill({ createdAt: bangkokInstant(2026, 1, 10), totalSatang: 50_000, cashAmountSatang: 50_000 });
    await createBill({
      createdAt: bangkokInstant(2026, 1, 10, 14),
      totalSatang: 99_999,
      status: "CANCELLED",
      cashAmountSatang: 99_999,
    });

    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);

    const summary = await db.prisma.dailySummary.findUniqueOrThrow({
      where: { branchId_date: { branchId, date: day } },
    });
    expect(summary.recognizedRevenueSatang).toBe(50_000);
    expect(summary.paymentCashSatang).toBe(50_000);
    expect(summary.cashInSatang).toBe(50_000);
    expect(summary.cashInPackageSatang).toBe(0);
  });

  it("tracks a TRANSFER payment in paymentTransferSatang and leaves cashInSatang unaffected (transfer is not drawer cash)", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 21);
    const dayInstant = bangkokInstant(2026, 1, 21);

    await db.prisma.bill.create({
      data: {
        branchId,
        billNumber: "BTRANSFER01",
        subtotalSatang: 45_000,
        totalSatang: 45_000,
        status: "PAID",
        createdAt: dayInstant,
        payments: { create: [{ branchId, method: "TRANSFER", amountSatang: 45_000 }] },
      },
    });

    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);

    const summary = await db.prisma.dailySummary.findUniqueOrThrow({
      where: { branchId_date: { branchId, date: day } },
    });
    expect(summary.paymentTransferSatang).toBe(45_000);
    expect(summary.recognizedRevenueSatang).toBe(45_000);
    expect(summary.paymentCashSatang).toBe(0);
    expect(summary.cashInSatang).toBe(0);
  });

  it("counts a package purchase into courseSold*/cashInPackageSatang, combines with bill cash into cashInSatang, and counts a ledger USE into courseUsedCount", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 11);
    const dayInstant = bangkokInstant(2026, 1, 11);
    const member = await createMember();

    const catalogPackage = await db.prisma.package.create({
      data: { branchId, name: "คอร์สมูลค่า 1,200", type: "VALUE", priceSatang: 120_000, validDays: 365 },
    });
    const memberPackage = await db.prisma.memberPackage.create({
      data: {
        branchId,
        memberId: member.id,
        packageId: catalogPackage.id,
        name: catalogPackage.name,
        type: "VALUE",
        priceSatang: 120_000,
        valueSatang: 120_000,
        purchasedAt: dayInstant,
        validDays: 365,
        expiresAt: new Date(dayInstant.getTime() + 365 * 24 * 60 * 60_000),
      },
    });
    await db.prisma.memberPackageLedgerEntry.create({
      data: { branchId, memberPackageId: memberPackage.id, kind: "USE", delta: -10_000, createdAt: dayInstant },
    });
    await createBill({ createdAt: dayInstant, totalSatang: 30_000, cashAmountSatang: 30_000 });

    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);

    const summary = await db.prisma.dailySummary.findUniqueOrThrow({
      where: { branchId_date: { branchId, date: day } },
    });
    expect(summary.courseSoldCount).toBe(1);
    expect(summary.courseSoldValueSatang).toBe(120_000);
    expect(summary.cashInPackageSatang).toBe(120_000);
    expect(summary.paymentCashSatang).toBe(30_000);
    expect(summary.cashInSatang).toBe(150_000);
    expect(summary.courseUsedCount).toBe(1);
  });

  it("classifies a member's first-ever bill as new, and a later bill from the same member as returning", async () => {
    const db = await import("@lotus-desk/db");
    const member = await createMember();

    const firstDay = bangkokDateArg(2026, 1, 12);
    await createBill({ createdAt: bangkokInstant(2026, 1, 12), totalSatang: 10_000, memberId: member.id, cashAmountSatang: 10_000 });
    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, firstDay);
    const firstSummary = await db.prisma.dailySummary.findUniqueOrThrow({
      where: { branchId_date: { branchId, date: firstDay } },
    });
    expect(firstSummary.newCustomerCount).toBe(1);
    expect(firstSummary.returningCustomerCount).toBe(0);

    const laterDay = bangkokDateArg(2026, 1, 15);
    await createBill({ createdAt: bangkokInstant(2026, 1, 15), totalSatang: 20_000, memberId: member.id, cashAmountSatang: 20_000 });
    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, laterDay);
    const laterSummary = await db.prisma.dailySummary.findUniqueOrThrow({
      where: { branchId_date: { branchId, date: laterDay } },
    });
    expect(laterSummary.newCustomerCount).toBe(0);
    expect(laterSummary.returningCustomerCount).toBe(1);
  });

  it("counts a NO_SHOW appointment item into noShowCount", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 16);
    const staff = await createStaff();
    const appointment = await db.prisma.appointment.create({ data: { branchId } });
    const start = bangkokInstant(2026, 1, 16);
    await db.prisma.appointmentItem.create({
      data: {
        branchId,
        appointmentId: appointment.id,
        staffId: staff.id,
        roomId,
        serviceVariantId,
        status: "NO_SHOW",
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        roomCapacityAtBooking: 1,
      },
    });

    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);

    const summary = await db.prisma.dailySummary.findUniqueOrThrow({
      where: { branchId_date: { branchId, date: day } },
    });
    expect(summary.noShowCount).toBe(1);
  });

  it("is idempotent: computing 3 times in a row for the same branch+date yields one row with identical values every time", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 17);
    await createBill({ createdAt: bangkokInstant(2026, 1, 17), totalSatang: 42_000, cashAmountSatang: 42_000 });

    const snapshots: unknown[] = [];
    for (let i = 0; i < 3; i += 1) {
      await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);
      const rows = await db.prisma.dailySummary.findMany({ where: { branchId, date: day } });
      expect(rows).toHaveLength(1);
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = rows[0]!;
      snapshots.push(rest);
    }

    expect(snapshots[0]).toEqual(snapshots[1]);
    expect(snapshots[1]).toEqual(snapshots[2]);
    expect((snapshots[0] as { recognizedRevenueSatang: number }).recognizedRevenueSatang).toBe(42_000);
  });

  it("gives a staff with only a scheduled shift (no completed job) scheduledMinutes but zero worked/job/commission", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 18);
    const staff = await createStaff();
    const shiftTemplate = await db.prisma.shiftTemplate.create({
      data: { branchId, name: "กะเช้า", startMin: 540, endMin: 600 },
    });
    await db.prisma.staffShift.create({
      data: { branchId, staffId: staff.id, shiftTemplateId: shiftTemplate.id, date: day, startMin: 540, endMin: 600 },
    });

    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);

    const row = await db.prisma.dailyStaffSummary.findUniqueOrThrow({
      where: { branchId_date_staffId: { branchId, date: day, staffId: staff.id } },
    });
    expect(row.scheduledMinutes).toBe(60);
    expect(row.workedMinutes).toBe(0);
    expect(row.jobCount).toBe(0);
    expect(row.commissionSatang).toBe(0);
  });

  it("gives a staff with a completed non-voided job (no shift) correct worked/job/commission and zero scheduledMinutes, excluding a voided job on the same day", async () => {
    const db = await import("@lotus-desk/db");
    const day = bangkokDateArg(2026, 1, 19);
    const staff = await createStaff();

    const started = bangkokInstant(2026, 1, 19, 10, 0);
    const completed = bangkokInstant(2026, 1, 19, 11, 30); // 90 นาที
    await createCompletedServiceJob({ staffId: staff.id, startedAt: started, completedAt: completed, commissionSatang: 15_000 });

    // ใบงานที่ถูกยกเลิก (voidedAt ไม่ null) วันเดียวกัน — ต้องไม่ถูกนับ
    const voidedStart = bangkokInstant(2026, 1, 19, 12, 0);
    const voidedCompleted = bangkokInstant(2026, 1, 19, 13, 0);
    await createCompletedServiceJob({
      staffId: staff.id,
      startedAt: voidedStart,
      completedAt: voidedCompleted,
      commissionSatang: 99_999,
      voidedAt: voidedCompleted,
    });

    await dailySummaryService.computeAndUpsertForBranchAndDate(branchId, day);

    const row = await db.prisma.dailyStaffSummary.findUniqueOrThrow({
      where: { branchId_date_staffId: { branchId, date: day, staffId: staff.id } },
    });
    expect(row.scheduledMinutes).toBe(0);
    expect(row.workedMinutes).toBe(90);
    expect(row.jobCount).toBe(1);
    expect(row.commissionSatang).toBe(15_000);
  });
});

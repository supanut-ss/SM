import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest (แพทเทิร์นเดียวกับ
 * apps/api/src/modules/payroll/test/payroll.e2e-spec.ts) — ครอบเกณฑ์ผ่านของ T7.2: /daily-summary (days +
 * totals), /today (live คำนวณสด ไม่มีแถว DailySummary), /staff-utilization (join staff + filter staffId),
 * /courses/remaining และ /courses/expiring (balance จาก ledger, กรอง status/expiresAt), /customers/dormant
 * (สมาชิกที่บิลล่าสุดเก่ากว่า N วัน ไม่รวมสมาชิกที่ไม่เคยมีบิลเลย) และ branch scoping ของทุก endpoint
 */
describe("Reports (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let cashierCookies: string[];

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "REPORTS-CTRL-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "REPORTS-CTRL-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const permission = await prisma.permission.create({ data: { key: "report:view", description: "ดูรายงาน" } });
    const cashierRole = await prisma.role.create({ data: { key: "cashier", name: "แคชเชียร์" } });
    await prisma.rolePermission.create({ data: { roleId: cashierRole.id, permissionId: permission.id } });

    const cashierEmail = "cashier-reports-a@lotusdesk.local";
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

  let memberCounter = 0;
  async function createMember(branchId: string) {
    memberCounter += 1;
    const db = await import("@lotus-desk/db");
    return db.prisma.member.create({
      data: {
        branchId,
        code: `RPT-M${memberCounter}`,
        name: `สมาชิกทดสอบรายงาน ${memberCounter}`,
        phone: `081000${1000 + memberCounter}`,
      },
    });
  }

  let billCounter = 0;
  async function createBill(opts: {
    branchId: string;
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
        branchId: opts.branchId,
        memberId: opts.memberId ?? null,
        billNumber: `RB${String(billCounter).padStart(6, "0")}`,
        subtotalSatang: opts.totalSatang,
        totalSatang: opts.totalSatang,
        status: opts.status ?? "PAID",
        createdAt: opts.createdAt,
        payments:
          opts.cashAmountSatang !== undefined
            ? { create: [{ branchId: opts.branchId, method: "CASH", amountSatang: opts.cashAmountSatang }] }
            : undefined,
      },
    });
  }

  let packageCounter = 0;
  async function createValuePackageForMember(opts: {
    branchId: string;
    memberId: string;
    priceSatang: number;
    valueSatang: number;
    status?: "ACTIVE" | "CLOSED";
    expiresAt: Date;
    purchasedAt?: Date;
  }) {
    packageCounter += 1;
    const db = await import("@lotus-desk/db");
    const catalogPackage = await db.prisma.package.create({
      data: {
        branchId: opts.branchId,
        name: `คอร์สทดสอบ ${packageCounter}`,
        type: "VALUE",
        priceSatang: opts.priceSatang,
        valueSatang: opts.valueSatang,
        validDays: 365,
      },
    });
    return db.prisma.memberPackage.create({
      data: {
        branchId: opts.branchId,
        memberId: opts.memberId,
        packageId: catalogPackage.id,
        name: catalogPackage.name,
        type: "VALUE",
        priceSatang: opts.priceSatang,
        valueSatang: opts.valueSatang,
        purchasedAt: opts.purchasedAt ?? new Date(),
        validDays: 365,
        expiresAt: opts.expiresAt,
        status: opts.status ?? "ACTIVE",
      },
    });
  }

  function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60_000);
  }
  function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60_000);
  }

  describe("GET /daily-summary", () => {
    it("returns seeded days with field-by-field totals, and an empty range returns all-zero totals", async () => {
      const db = await import("@lotus-desk/db");
      const day1 = new Date(Date.UTC(2026, 1, 1));
      const day2 = new Date(Date.UTC(2026, 1, 2));
      const day3 = new Date(Date.UTC(2026, 1, 3));

      const baseSummaryFields = {
        cashInSatang: 0,
        cashInPackageSatang: 0,
        paymentCashSatang: 0,
        paymentPackageSatang: 0,
        paymentVoucherSatang: 0,
        paymentComplimentarySatang: 0,
        courseSoldCount: 0,
        courseSoldValueSatang: 0,
        courseUsedCount: 0,
        newCustomerCount: 0,
        returningCustomerCount: 0,
        noShowCount: 0,
      };
      await db.prisma.dailySummary.create({
        data: { branchId: branchAId, date: day1, recognizedRevenueSatang: 10_000, ...baseSummaryFields, paymentCashSatang: 10_000, cashInSatang: 10_000 },
      });
      await db.prisma.dailySummary.create({
        data: { branchId: branchAId, date: day2, recognizedRevenueSatang: 20_000, ...baseSummaryFields, paymentCashSatang: 20_000, cashInSatang: 20_000, newCustomerCount: 1 },
      });
      await db.prisma.dailySummary.create({
        data: { branchId: branchAId, date: day3, recognizedRevenueSatang: 5_000, ...baseSummaryFields, paymentVoucherSatang: 5_000 },
      });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/daily-summary`)
        .query({ from: "2026-02-01", to: "2026-02-03" })
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      expect(res.body.days).toHaveLength(3);
      expect(res.body.totals.recognizedRevenueSatang).toBe(35_000);
      expect(res.body.totals.paymentCashSatang).toBe(30_000);
      expect(res.body.totals.paymentVoucherSatang).toBe(5_000);
      expect(res.body.totals.newCustomerCount).toBe(1);

      const empty = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/daily-summary`)
        .query({ from: "2026-03-01", to: "2026-03-31" })
        .set("Cookie", cashierCookies);
      expect(empty.status).toBe(200);
      expect(empty.body.days).toEqual([]);
      expect(empty.body.totals).toEqual({
        recognizedRevenueSatang: 0,
        cashInSatang: 0,
        cashInPackageSatang: 0,
        paymentCashSatang: 0,
        paymentPackageSatang: 0,
        paymentVoucherSatang: 0,
        paymentComplimentarySatang: 0,
        courseSoldCount: 0,
        courseSoldValueSatang: 0,
        courseUsedCount: 0,
        newCustomerCount: 0,
        returningCustomerCount: 0,
        noShowCount: 0,
      });
    });

    it("rejects a malformed date and a to before from with 422", async () => {
      const malformed = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/daily-summary`)
        .query({ from: "2026-2-1", to: "2026-02-03" })
        .set("Cookie", cashierCookies);
      expect(malformed.status).toBe(422);

      const backwards = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/daily-summary`)
        .query({ from: "2026-02-10", to: "2026-02-01" })
        .set("Cookie", cashierCookies);
      expect(backwards.status).toBe(422);
    });

    it("never leaks another branch's DailySummary rows", async () => {
      const db = await import("@lotus-desk/db");
      const day = new Date(Date.UTC(2026, 1, 1));
      await db.prisma.dailySummary.create({
        data: {
          branchId: branchBId,
          date: day,
          recognizedRevenueSatang: 999_999,
          cashInSatang: 0,
          cashInPackageSatang: 0,
          paymentCashSatang: 0,
          paymentPackageSatang: 0,
          paymentVoucherSatang: 0,
          paymentComplimentarySatang: 0,
          courseSoldCount: 0,
          courseSoldValueSatang: 0,
          courseUsedCount: 0,
          newCustomerCount: 0,
          returningCustomerCount: 0,
          noShowCount: 0,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/daily-summary`)
        .query({ from: "2026-02-01", to: "2026-02-01" })
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      expect(res.body.totals.recognizedRevenueSatang).not.toBe(999_999);
      for (const day of res.body.days) {
        expect(day.branchId).toBe(branchAId);
      }

      const forbidden = await request(app.getHttpServer())
        .get(`/branches/${branchBId}/reports/daily-summary`)
        .query({ from: "2026-02-01", to: "2026-02-01" })
        .set("Cookie", cashierCookies);
      expect(forbidden.status).toBe(403);
    });
  });

  describe("GET /today", () => {
    it("reflects a bill created today live, with no DailySummary row required", async () => {
      const db = await import("@lotus-desk/db");
      await createBill({ branchId: branchAId, createdAt: new Date(), totalSatang: 12_345, cashAmountSatang: 12_345 });

      // เที่ยงคืน UTC ของ "วันนี้" ตามปฏิทินไทย (เทคนิคเดียวกับ toBangkokDateOnly ใน bangkok-time.ts)
      const bangkokNow = new Date(Date.now() + 7 * 60 * 60_000);
      const todayBangkokDateOnly = new Date(
        Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate()),
      );
      const existing = await db.prisma.dailySummary.findFirst({
        where: { branchId: branchAId, date: todayBangkokDateOnly },
      });
      expect(existing).toBeNull();

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/today`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      expect(res.body.recognizedRevenueSatang).toBeGreaterThanOrEqual(12_345);
      expect(res.body.paymentCashSatang).toBeGreaterThanOrEqual(12_345);
      expect(typeof res.body.date).toBe("string");
    });
  });

  describe("GET /staff-utilization", () => {
    it("includes staff.name/level and filters by staffId", async () => {
      const db = await import("@lotus-desk/db");
      const staffA = await db.prisma.staffProfile.create({
        data: { branchId: branchAId, name: "พนักงาน อ.", level: "SENIOR", skills: ["THAI_MASSAGE"] },
      });
      const staffB = await db.prisma.staffProfile.create({
        data: { branchId: branchAId, name: "พนักงาน บ.", level: "JUNIOR", skills: ["THAI_MASSAGE"] },
      });
      const day = new Date(Date.UTC(2026, 3, 1));
      await db.prisma.dailyStaffSummary.create({
        data: { branchId: branchAId, date: day, staffId: staffA.id, scheduledMinutes: 480, workedMinutes: 420, jobCount: 4, commissionSatang: 40_000 },
      });
      await db.prisma.dailyStaffSummary.create({
        data: { branchId: branchAId, date: day, staffId: staffB.id, scheduledMinutes: 480, workedMinutes: 300, jobCount: 3, commissionSatang: 25_000 },
      });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/staff-utilization`)
        .query({ from: "2026-04-01", to: "2026-04-01" })
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      expect(res.body.days).toHaveLength(2);
      expect(res.body.days.map((d: { staff: { name: string } }) => d.staff.name).sort()).toEqual(
        ["พนักงาน บ.", "พนักงาน อ."].sort(),
      );
      expect(res.body.days.find((d: { staffId: string }) => d.staffId === staffA.id).staff.level).toBe("SENIOR");

      const filtered = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/staff-utilization`)
        .query({ from: "2026-04-01", to: "2026-04-01", staffId: staffA.id })
        .set("Cookie", cashierCookies);
      expect(filtered.status).toBe(200);
      expect(filtered.body.days).toHaveLength(1);
      expect(filtered.body.days[0].staffId).toBe(staffA.id);
    });
  });

  describe("GET /courses/remaining and /courses/expiring", () => {
    it("computes balance as purchase delta + use delta", async () => {
      const db = await import("@lotus-desk/db");
      const member = await createMember(branchAId);
      const memberPackage = await createValuePackageForMember({
        branchId: branchAId,
        memberId: member.id,
        priceSatang: 100_000,
        valueSatang: 100_000,
        expiresAt: daysFromNow(200),
      });
      await db.prisma.memberPackageLedgerEntry.create({
        data: { branchId: branchAId, memberPackageId: memberPackage.id, kind: "PURCHASE", delta: 100_000 },
      });
      await db.prisma.memberPackageLedgerEntry.create({
        data: { branchId: branchAId, memberPackageId: memberPackage.id, kind: "USE", delta: -30_000 },
      });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/courses/remaining`)
        .query({ memberId: member.id })
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      const row = res.body.find((r: { id: string }) => r.id === memberPackage.id);
      expect(row).toBeDefined();
      expect(row.balance).toBe(70_000);
      expect(row.member.name).toBe(member.name);
    });

    it("lists a package expiring within the default 30 days, excludes one expiring in 100 days and a CLOSED one", async () => {
      const db = await import("@lotus-desk/db");
      const member = await createMember(branchAId);
      const soon = await createValuePackageForMember({
        branchId: branchAId,
        memberId: member.id,
        priceSatang: 50_000,
        valueSatang: 50_000,
        expiresAt: daysFromNow(10),
      });
      const far = await createValuePackageForMember({
        branchId: branchAId,
        memberId: member.id,
        priceSatang: 50_000,
        valueSatang: 50_000,
        expiresAt: daysFromNow(100),
      });
      const closedSoon = await createValuePackageForMember({
        branchId: branchAId,
        memberId: member.id,
        priceSatang: 50_000,
        valueSatang: 50_000,
        expiresAt: daysFromNow(5),
        status: "CLOSED",
      });
      for (const pkg of [soon, far, closedSoon]) {
        await db.prisma.memberPackageLedgerEntry.create({
          data: { branchId: branchAId, memberPackageId: pkg.id, kind: "PURCHASE", delta: 50_000 },
        });
      }

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/courses/expiring`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((r) => r.id);
      expect(ids).toContain(soon.id);
      expect(ids).not.toContain(far.id);
      expect(ids).not.toContain(closedSoon.id);
    });

    it("rejects a non-positive withinDays with 422", async () => {
      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/courses/expiring`)
        .query({ withinDays: "0" })
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(422);
    });

    it("never leaks another branch's ACTIVE MemberPackage rows into /courses/remaining", async () => {
      const memberB = await createMember(branchBId);
      const pkgB = await createValuePackageForMember({
        branchId: branchBId,
        memberId: memberB.id,
        priceSatang: 50_000,
        valueSatang: 50_000,
        expiresAt: daysFromNow(200),
      });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/courses/remaining`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((r) => r.id);
      expect(ids).not.toContain(pkgB.id);
    });
  });

  describe("GET /customers/dormant", () => {
    it("lists a member whose last visit was 90 days ago, excludes one from yesterday and one with zero bills", async () => {
      const gone = await createMember(branchAId);
      const recent = await createMember(branchAId);
      const never = await createMember(branchAId);

      await createBill({ branchId: branchAId, createdAt: daysAgo(90), totalSatang: 10_000, memberId: gone.id, cashAmountSatang: 10_000 });
      await createBill({ branchId: branchAId, createdAt: daysAgo(1), totalSatang: 10_000, memberId: recent.id, cashAmountSatang: 10_000 });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/customers/dormant`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      const memberIds = (res.body as Array<{ member: { id: string } }>).map((r) => r.member.id);
      expect(memberIds).toContain(gone.id);
      expect(memberIds).not.toContain(recent.id);
      expect(memberIds).not.toContain(never.id);
    });

    it("a cancelled-only bill history does not count as a visit (member stays dormant-eligible with no non-cancelled bill = never visited, excluded)", async () => {
      const cancelledOnly = await createMember(branchAId);
      await createBill({
        branchId: branchAId,
        createdAt: daysAgo(90),
        totalSatang: 10_000,
        memberId: cancelledOnly.id,
        status: "CANCELLED",
      });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/customers/dormant`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      const memberIds = (res.body as Array<{ member: { id: string } }>).map((r) => r.member.id);
      expect(memberIds).not.toContain(cancelledOnly.id);
    });

    it("never leaks a dormant member from another branch (bill.groupBy branch scoping)", async () => {
      const memberB = await createMember(branchBId);
      await createBill({ branchId: branchBId, createdAt: daysAgo(90), totalSatang: 10_000, memberId: memberB.id, cashAmountSatang: 10_000 });

      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/customers/dormant`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(200);
      const memberIds = (res.body as Array<{ member: { id: string } }>).map((r) => r.member.id);
      expect(memberIds).not.toContain(memberB.id);
    });

    it("rejects a negative daysSinceLastVisit with 422", async () => {
      const res = await request(app.getHttpServer())
        .get(`/branches/${branchAId}/reports/customers/dormant`)
        .query({ daysSinceLastVisit: "-5" })
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(422);
    });
  });

  describe("branch scoping and auth", () => {
    it("rejects the cashier of branch A from reading branch B's reports with 403", async () => {
      const res = await request(app.getHttpServer())
        .get(`/branches/${branchBId}/reports/today`)
        .set("Cookie", cashierCookies);
      expect(res.status).toBe(403);
    });

    it("rejects an unauthenticated request before it even checks branch scope", async () => {
      const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/reports/today`);
      expect(res.status).toBe(401);
    });
  });
});

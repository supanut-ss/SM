import { Controller, Get, Query, UnprocessableEntityException, UseGuards } from "@nestjs/common";
import type { DailyStaffSummary, DailySummary } from "@lotus-desk/db";
import { DailySummaryService } from "./daily-summary.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";
import { toBangkokDateOnly } from "./bangkok-time";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRING_WITHIN_DAYS = 30;
const DEFAULT_DORMANT_DAYS = 60;

const MEMBER_PACKAGE_INCLUDE = {
  member: { select: { name: true, code: true } },
  serviceVariant: { include: { service: true } },
} as const;

/** "YYYY-MM-DD" ตรง ๆ → Date เที่ยงคืน UTC ของวันปฏิทินไทยวันนั้น (เทคนิคเดียวกับ toBangkokDateOnly และ
 * AttendanceController.parseDateOnlyParam — ก็อปมาไว้ในไฟล์นี้แทนที่จะ import ข้ามโมดูล เพราะเป็น helper
 * เล็กมาก และ attendance/reports เป็นคนละโมดูลกัน ไม่อยากผูกกันโดยไม่จำเป็น) */
function parseDateOnlyParam(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new UnprocessableEntityException("รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD");
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** parse ทั้งคู่ from/to (ต้องมีทั้งคู่) + เช็คว่า to ต้องไม่มาก่อน from */
function parseDateRangeParams(from?: string, to?: string): { from: Date; to: Date } {
  if (!from || !to) {
    throw new UnprocessableEntityException("ต้องระบุ from และ to (YYYY-MM-DD)");
  }
  const fromDate = parseDateOnlyParam(from);
  const toDate = parseDateOnlyParam(to);
  if (toDate.getTime() < fromDate.getTime()) {
    throw new UnprocessableEntityException("to ต้องไม่มาก่อน from");
  }
  return { from: fromDate, to: toDate };
}

/** แปลง query string เป็นจำนวนเต็มบวก — คืนค่า default เมื่อไม่ส่งมา, โยน error เมื่อส่งมาแต่ไม่ใช่จำนวนเต็มบวก */
function parsePositiveIntParam(value: string | undefined, fieldName: string, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UnprocessableEntityException(`${fieldName} ต้องเป็นจำนวนเต็มบวก`);
  }
  return parsed;
}

function sumDailySummaries(days: DailySummary[]) {
  const totals = {
    recognizedRevenueSatang: 0,
    cashInSatang: 0,
    cashInPackageSatang: 0,
    paymentCashSatang: 0,
    paymentPackageSatang: 0,
    paymentVoucherSatang: 0,
    paymentComplimentarySatang: 0,
    paymentTransferSatang: 0,
    courseSoldCount: 0,
    courseSoldValueSatang: 0,
    courseUsedCount: 0,
    newCustomerCount: 0,
    returningCustomerCount: 0,
    noShowCount: 0,
  };
  for (const day of days) {
    totals.recognizedRevenueSatang += day.recognizedRevenueSatang;
    totals.cashInSatang += day.cashInSatang;
    totals.cashInPackageSatang += day.cashInPackageSatang;
    totals.paymentCashSatang += day.paymentCashSatang;
    totals.paymentPackageSatang += day.paymentPackageSatang;
    totals.paymentVoucherSatang += day.paymentVoucherSatang;
    totals.paymentComplimentarySatang += day.paymentComplimentarySatang;
    totals.paymentTransferSatang += day.paymentTransferSatang;
    totals.courseSoldCount += day.courseSoldCount;
    totals.courseSoldValueSatang += day.courseSoldValueSatang;
    totals.courseUsedCount += day.courseUsedCount;
    totals.newCustomerCount += day.newCustomerCount;
    totals.returningCustomerCount += day.returningCustomerCount;
    totals.noShowCount += day.noShowCount;
  }
  return totals;
}

/**
 * รายงาน (T7.2) — endpoint อ่านอย่างเดียวทั้งหมด ไม่มี @AuditEntity() ที่ไหนเลยในไฟล์นี้เพราะไม่มี mutation
 * อ่านย้อนหลังจาก DailySummary/DailyStaffSummary (T7.1 pre-aggregate ไว้แล้ว) เป็นหลัก ยกเว้น "วันนี้"
 * (ยังไม่ปิดวัน ไม่มีแถวให้อ่าน จึงคำนวณสดผ่าน DailySummaryService.computeForBranchAndDate) และ "คอร์ส
 * คงเหลือ/ใกล้หมดอายุ"/"ลูกค้าที่หายไป" ที่เป็น snapshot สถานะปัจจุบัน ไม่ pre-aggregate (ดู docs/decisions.md
 * ADR-036 ข้อ 2)
 */
@Controller("branches/:branchId/reports")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailySummaryService: DailySummaryService,
  ) {}

  @Get("daily-summary")
  @RequirePermission("view", "report")
  async dailySummary(
    @CurrentBranch() branch: BranchContext,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
  ) {
    const { from, to } = parseDateRangeParams(fromParam, toParam);

    const days = await this.prisma.forBranch(branch.branchId).dailySummary.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });

    return { days, totals: sumDailySummaries(days) };
  }

  /** "วันนี้" (เวลาไทย) — คำนวณสดเสมอ ไม่มีแถว DailySummary ให้อ่านจนกว่า cron ตี 2 ของพรุ่งนี้จะรัน
   * รวม staffSummaries (สรุปต่อพนักงาน) ไว้ในผลลัพธ์เดียวกันเลย ไม่ต้องยิงอีก endpoint แยก */
  @Get("today")
  @RequirePermission("view", "report")
  async today(@CurrentBranch() branch: BranchContext) {
    const now = new Date();
    const today = toBangkokDateOnly(now);
    const computation = await this.dailySummaryService.computeForBranchAndDate(branch.branchId, now);

    return { date: today.toISOString().slice(0, 10), ...computation };
  }

  @Get("staff-utilization")
  @RequirePermission("view", "report")
  async staffUtilization(
    @CurrentBranch() branch: BranchContext,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
    @Query("staffId") staffId?: string,
  ): Promise<{ days: Array<DailyStaffSummary & { staff: { name: string; level: string } }> }> {
    const { from, to } = parseDateRangeParams(fromParam, toParam);

    const days = await this.prisma.forBranch(branch.branchId).dailyStaffSummary.findMany({
      where: { date: { gte: from, lte: to }, ...(staffId ? { staffId } : {}) },
      orderBy: [{ date: "asc" }],
      include: { staff: { select: { name: true, level: true } } },
    });

    return { days };
  }

  @Get("courses/remaining")
  @RequirePermission("view", "report")
  async coursesRemaining(@CurrentBranch() branch: BranchContext, @Query("memberId") memberId?: string) {
    const records = await this.prisma.forBranch(branch.branchId).memberPackage.findMany({
      where: { status: "ACTIVE", ...(memberId ? { memberId } : {}) },
      include: MEMBER_PACKAGE_INCLUDE,
      orderBy: { expiresAt: "asc" },
    });

    return this.attachBalances(records);
  }

  @Get("courses/expiring")
  @RequirePermission("view", "report")
  async coursesExpiring(@CurrentBranch() branch: BranchContext, @Query("withinDays") withinDaysParam?: string) {
    const withinDays = parsePositiveIntParam(withinDaysParam, "withinDays", DEFAULT_EXPIRING_WITHIN_DAYS);
    const now = new Date();
    const until = new Date(now.getTime() + withinDays * MS_PER_DAY);

    const records = await this.prisma.forBranch(branch.branchId).memberPackage.findMany({
      where: { status: "ACTIVE", expiresAt: { gte: now, lte: until } },
      include: MEMBER_PACKAGE_INCLUDE,
      orderBy: { expiresAt: "asc" },
    });

    return this.attachBalances(records);
  }

  /**
   * ลูกค้าที่หายไปเกิน N วัน (T7.3 ใช้ในแดชบอร์ด) — สมาชิกที่มีบิล (ไม่ยกเลิก) อย่างน้อยหนึ่งใบ แต่บิลล่าสุด
   * เก่ากว่า N วัน สมาชิกที่ไม่เคยมีบิลเลยไม่ถือว่า "หายไป" (ไม่เคยมาตั้งแต่แรก) จึงไม่รวมในผลลัพธ์
   *
   * `bill.groupBy` ไม่อยู่ใน SCOPED_OPERATIONS ของ branch-scope.extension.ts (กรองเฉพาะ findMany/findFirst/
   * findUnique/count) จึง prisma.forBranch(branchId) ไม่ช่วยกรอง branchId ให้อัตโนมัติสำหรับ query นี้ —
   * ต้องใส่ branchId ใน where ของ groupBy เองตรง ๆ (CLAUDE.md ข้อ 5)
   */
  @Get("customers/dormant")
  @RequirePermission("view", "report")
  async dormantCustomers(
    @CurrentBranch() branch: BranchContext,
    @Query("daysSinceLastVisit") daysSinceLastVisitParam?: string,
  ) {
    const daysSinceLastVisit = parsePositiveIntParam(
      daysSinceLastVisitParam,
      "daysSinceLastVisit",
      DEFAULT_DORMANT_DAYS,
    );
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysSinceLastVisit * MS_PER_DAY);

    const lastVisitByMember = await this.prisma.client.bill.groupBy({
      by: ["memberId"],
      where: { branchId: branch.branchId, memberId: { not: null }, status: { not: "CANCELLED" } },
      _max: { createdAt: true },
    });

    const dormant = lastVisitByMember.filter(
      (row) => row._max.createdAt !== null && row._max.createdAt.getTime() < cutoff.getTime(),
    );
    if (dormant.length === 0) return [];

    const memberIds = dormant.map((row) => row.memberId).filter((id): id is string => id !== null);
    const members = await this.prisma.forBranch(branch.branchId).member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, phone: true, code: true },
    });
    const memberById = new Map(members.map((member) => [member.id, member]));

    return dormant
      .map((row) => {
        const member = memberById.get(row.memberId as string);
        const lastVisitAt = row._max.createdAt as Date;
        const daysSince = Math.floor((now.getTime() - lastVisitAt.getTime()) / MS_PER_DAY);
        return member ? { member, lastVisitAt, daysSinceLastVisit: daysSince } : null;
      })
      .filter((row): row is { member: (typeof members)[number]; lastVisitAt: Date; daysSinceLastVisit: number } => row !== null)
      .sort((a, b) => a.lastVisitAt.getTime() - b.lastVisitAt.getTime());
  }

  /** ต่อยอด balance ให้ MemberPackage แต่ละใบ (แพทเทิร์นเดียวกับ MemberPackageController.list T5.2) —
   * groupBy ตัวที่สองนี้กรองด้วย memberPackageId ที่มาจาก records ที่ผ่าน prisma.forBranch มาแล้ว จึง
   * scoped ทางอ้อมโดยไม่ต้องใส่ branchId ซ้ำ (ตรงกับ precedent ที่มีอยู่แล้วใน member-package.controller.ts) */
  private async attachBalances<T extends { id: string }>(records: T[]): Promise<Array<T & { balance: number }>> {
    if (records.length === 0) return [];

    const sums = await this.prisma.client.memberPackageLedgerEntry.groupBy({
      by: ["memberPackageId"],
      where: { memberPackageId: { in: records.map((r) => r.id) } },
      _sum: { delta: true },
    });
    const balanceByPackageId = new Map(sums.map((s) => [s.memberPackageId, s._sum.delta ?? 0]));

    return records.map((r) => ({ ...r, balance: balanceByPackageId.get(r.id) ?? 0 }));
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { calculateStaffCommission, type ServiceJobForCommission } from "@lotus-desk/core";
import { PrismaService } from "../../prisma/prisma.service";
import { bangkokDayRange, toBangkokDateOnly } from "./bangkok-time";

/**
 * สรุปรายวัน (T7.1) — คำนวณสถิติของสาขาหนึ่งในวันปฏิทินไทยหนึ่งวัน แล้วเขียนทับ (upsert) ลง DailySummary
 * และ DailyStaffSummary เสมอ ต้อง idempotent 100%: เรียกซ้ำกี่ครั้งก็คำนวณใหม่จากข้อมูลต้นทางทั้งหมดทุกครั้ง
 * (ไม่มี +=/สะสมค่าเดิม) แล้วทับด้วยตัวเลขล่าสุด — ห้าม UPDATE ranking แบบ increment เด็ดขาด
 *
 * ตัวเลขทั้งหมดคำนวณจาก query ที่กรอง branchId ผ่าน PrismaService.forBranch เสมอ (ยกเว้นการวนลูป
 * ทุกสาขาใน computeAndUpsertForAllBranches ที่ต้องอ่าน Branch ตรง ๆ — Branch เองไม่ใช่ "ข้อมูลในสาขา"
 * ดู comment บน BRANCH_SCOPED_MODELS) ดูรายละเอียด spec การคำนวณแต่ละตัวเลขที่ docs/PLAN.md T7.1
 */
/** ผลลัพธ์การคำนวณของ DailySummaryService.computeForBranchAndDate — ตัวเลขล้วน ๆ ยังไม่ได้เขียนลง DB
 * (T7.2 ใช้ตรง ๆ สำหรับรายงาน "วันนี้" ที่ยังไม่ปิดวัน จึงยังไม่มีแถว DailySummary ให้อ่าน) */
export interface DailySummaryComputation {
  recognizedRevenueSatang: number;
  cashInSatang: number;
  cashInPackageSatang: number;
  paymentCashSatang: number;
  paymentPackageSatang: number;
  paymentVoucherSatang: number;
  paymentComplimentarySatang: number;
  courseSoldCount: number;
  courseSoldValueSatang: number;
  courseUsedCount: number;
  newCustomerCount: number;
  returningCustomerCount: number;
  noShowCount: number;
  staffSummaries: Array<{
    staffId: string;
    scheduledMinutes: number;
    workedMinutes: number;
    jobCount: number;
    commissionSatang: number;
  }>;
}

@Injectable()
export class DailySummaryService {
  private readonly logger = new Logger(DailySummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** ระบบเป็นร้านสาขาเดียวช่วงนี้ (docs/PLAN.md §1.1) แต่ไม่ hardcode branchId — วนทุกสาขาที่มีอยู่จริง */
  async computeAndUpsertForAllBranches(date: Date): Promise<void> {
    const branches = await this.prisma.client.branch.findMany({ select: { id: true } });
    for (const branch of branches) {
      await this.computeAndUpsertForBranchAndDate(branch.id, date);
    }
  }

  async computeAndUpsertForBranchAndDate(branchId: string, date: Date): Promise<void> {
    const dateOnly = toBangkokDateOnly(date);
    const computation = await this.computeForBranchAndDate(branchId, date);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.dailySummary.upsert({
        where: { branchId_date: { branchId, date: dateOnly } },
        create: {
          branchId,
          date: dateOnly,
          recognizedRevenueSatang: computation.recognizedRevenueSatang,
          cashInSatang: computation.cashInSatang,
          cashInPackageSatang: computation.cashInPackageSatang,
          paymentCashSatang: computation.paymentCashSatang,
          paymentPackageSatang: computation.paymentPackageSatang,
          paymentVoucherSatang: computation.paymentVoucherSatang,
          paymentComplimentarySatang: computation.paymentComplimentarySatang,
          courseSoldCount: computation.courseSoldCount,
          courseSoldValueSatang: computation.courseSoldValueSatang,
          courseUsedCount: computation.courseUsedCount,
          newCustomerCount: computation.newCustomerCount,
          returningCustomerCount: computation.returningCustomerCount,
          noShowCount: computation.noShowCount,
        },
        update: {
          recognizedRevenueSatang: computation.recognizedRevenueSatang,
          cashInSatang: computation.cashInSatang,
          cashInPackageSatang: computation.cashInPackageSatang,
          paymentCashSatang: computation.paymentCashSatang,
          paymentPackageSatang: computation.paymentPackageSatang,
          paymentVoucherSatang: computation.paymentVoucherSatang,
          paymentComplimentarySatang: computation.paymentComplimentarySatang,
          courseSoldCount: computation.courseSoldCount,
          courseSoldValueSatang: computation.courseSoldValueSatang,
          courseUsedCount: computation.courseUsedCount,
          newCustomerCount: computation.newCustomerCount,
          returningCustomerCount: computation.returningCustomerCount,
          noShowCount: computation.noShowCount,
        },
      });

      for (const staffSummary of computation.staffSummaries) {
        await tx.dailyStaffSummary.upsert({
          where: { branchId_date_staffId: { branchId, date: dateOnly, staffId: staffSummary.staffId } },
          create: {
            branchId,
            date: dateOnly,
            staffId: staffSummary.staffId,
            scheduledMinutes: staffSummary.scheduledMinutes,
            workedMinutes: staffSummary.workedMinutes,
            jobCount: staffSummary.jobCount,
            commissionSatang: staffSummary.commissionSatang,
          },
          update: {
            scheduledMinutes: staffSummary.scheduledMinutes,
            workedMinutes: staffSummary.workedMinutes,
            jobCount: staffSummary.jobCount,
            commissionSatang: staffSummary.commissionSatang,
          },
        });
      }
    });

    this.logger.debug(
      `สรุปสาขา ${branchId} วันที่ ${dateOnly.toISOString().slice(0, 10)}: ` +
        `รายได้ ${computation.recognizedRevenueSatang} สตางค์, พนักงาน ${computation.staffSummaries.length} คน`,
    );
  }

  /** คำนวณล้วน ๆ (ไม่เขียนลง DB) — ใช้ทั้งจาก computeAndUpsertForBranchAndDate (เขียนทับ DailySummary/
   * DailyStaffSummary) และจาก ReportsController./today (T7.2, live ของวันปัจจุบันที่ยังไม่ปิดวัน จึงยังไม่มี
   * แถวให้อ่าน) — แยกออกมาให้ทั้งสองทางเรียกตรรกะเดียวกันเป๊ะ ไม่มี logic ซ้ำ */
  async computeForBranchAndDate(branchId: string, date: Date): Promise<DailySummaryComputation> {
    const dateOnly = toBangkokDateOnly(date);
    const { start, end } = bangkokDayRange(date);
    const db = this.prisma.forBranch(branchId);

    // 1. บิลของวันนั้น (ไม่นับบิลที่ยกเลิก)
    const bills = await db.bill.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { payments: true },
    });
    const activeBills = bills.filter((bill) => bill.status !== "CANCELLED");

    const recognizedRevenueSatang = activeBills.reduce((sum, bill) => sum + bill.totalSatang, 0);

    let paymentCashSatang = 0;
    let paymentPackageSatang = 0;
    let paymentVoucherSatang = 0;
    let paymentComplimentarySatang = 0;
    for (const bill of activeBills) {
      for (const payment of bill.payments) {
        switch (payment.method) {
          case "CASH":
            paymentCashSatang += payment.amountSatang;
            break;
          case "PACKAGE":
            paymentPackageSatang += payment.amountSatang;
            break;
          case "VOUCHER":
            paymentVoucherSatang += payment.amountSatang;
            break;
          case "COMPLIMENTARY":
            paymentComplimentarySatang += payment.amountSatang;
            break;
        }
      }
    }

    // 2. คอร์ส/แพ็กเกจที่ซื้อวันนั้น — ไม่มีข้อมูลช่องทางชำระของการซื้อคอร์ส (ช่องว่างที่รู้อยู่แล้ว
    // ตั้งแต่ milestone ก่อนหน้า) จึงใช้ priceSatang ทั้งก้อนเป็นตัวแทนเงินเข้า
    const purchasedPackages = await db.memberPackage.findMany({
      where: { purchasedAt: { gte: start, lt: end } },
      select: { priceSatang: true },
    });
    const courseSoldCount = purchasedPackages.length;
    const courseSoldValueSatang = purchasedPackages.reduce((sum, pkg) => sum + pkg.priceSatang, 0);
    const cashInPackageSatang = courseSoldValueSatang;
    const cashInSatang = paymentCashSatang + cashInPackageSatang;

    // 3. ตัดใช้คอร์สวันนั้น
    const courseUsedCount = await db.memberPackageLedgerEntry.count({
      where: { kind: "USE", createdAt: { gte: start, lt: end } },
    });

    // 4. ลูกค้าใหม่ vs เก่า — จากสมาชิกที่มีบิล (ไม่ยกเลิก) วันนั้น เทียบกับบิลก่อนหน้าวันนั้น
    const distinctMemberIds = [
      ...new Set(activeBills.map((bill) => bill.memberId).filter((id): id is string => id !== null)),
    ];
    let newCustomerCount = 0;
    let returningCustomerCount = 0;
    if (distinctMemberIds.length > 0) {
      const priorBills = await db.bill.findMany({
        where: { memberId: { in: distinctMemberIds }, status: { not: "CANCELLED" }, createdAt: { lt: start } },
        select: { memberId: true },
        distinct: ["memberId"],
      });
      const returningMemberIds = new Set(priorBills.map((bill) => bill.memberId));
      for (const memberId of distinctMemberIds) {
        if (returningMemberIds.has(memberId)) {
          returningCustomerCount += 1;
        } else {
          newCustomerCount += 1;
        }
      }
    }

    // 5. ไม่มาวันนั้น
    const noShowCount = await db.appointmentItem.count({
      where: { status: "NO_SHOW", startAt: { gte: start, lt: end } },
    });

    // 6. สรุปต่อพนักงาน — เฉพาะคนที่มีสัญญาณอย่างน้อยหนึ่งอย่าง (กะที่ตั้งไว้ หรือ ใบงานที่จบวันนั้น)
    const shifts = await db.staffShift.findMany({
      where: { date: dateOnly },
      select: { staffId: true, startMin: true, endMin: true },
    });
    const scheduledByStaff = new Map<string, number>();
    for (const shift of shifts) {
      scheduledByStaff.set(
        shift.staffId,
        (scheduledByStaff.get(shift.staffId) ?? 0) + (shift.endMin - shift.startMin),
      );
    }

    const completedJobs = await db.serviceJob.findMany({
      where: { completedAt: { not: null, gte: start, lt: end }, voidedAt: null },
      select: { id: true, staffId: true, startedAt: true, completedAt: true, commissionSatang: true, voidedAt: true },
    });
    const workedByStaff = new Map<string, number>();
    for (const job of completedJobs) {
      if (job.completedAt === null) continue; // กรองไว้แล้วใน where แต่ type ยังเป็น nullable
      const minutes = Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 60_000);
      workedByStaff.set(job.staffId, (workedByStaff.get(job.staffId) ?? 0) + minutes);
    }

    const commissionInput: ServiceJobForCommission[] = completedJobs.map((job) => ({
      jobId: job.id,
      staffId: job.staffId,
      commissionSatang: job.commissionSatang,
      completedAt: job.completedAt,
      voidedAt: job.voidedAt,
    }));
    // periodEnd ของ calculateStaffCommission เป็น exclusive เหมือนกับ `end` ของช่วงวันปฏิทินไทยพอดี
    const commissionBreakdown = calculateStaffCommission({
      jobs: commissionInput,
      periodStart: start,
      periodEnd: end,
    });
    const commissionByStaff = new Map(commissionBreakdown.map((breakdown) => [breakdown.staffId, breakdown]));

    const staffIds = new Set<string>([...scheduledByStaff.keys(), ...workedByStaff.keys()]);

    const staffSummaries = [...staffIds].map((staffId) => {
      const scheduledMinutes = scheduledByStaff.get(staffId) ?? 0;
      const workedMinutes = workedByStaff.get(staffId) ?? 0;
      const commission = commissionByStaff.get(staffId);
      const jobCount = commission?.jobCount ?? 0;
      const commissionSatang = commission?.totalCommissionSatang ?? 0;
      return { staffId, scheduledMinutes, workedMinutes, jobCount, commissionSatang };
    });

    return {
      recognizedRevenueSatang,
      cashInSatang,
      cashInPackageSatang,
      paymentCashSatang,
      paymentPackageSatang,
      paymentVoucherSatang,
      paymentComplimentarySatang,
      courseSoldCount,
      courseSoldValueSatang,
      courseUsedCount,
      newCustomerCount,
      returningCustomerCount,
      noShowCount,
      staffSummaries,
    };
  }
}

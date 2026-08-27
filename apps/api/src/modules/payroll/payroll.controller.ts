import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  reopenPayrollPeriodSchema,
  type ReopenPayrollPeriodInput,
} from "@lotus-desk/contracts";
import { calculateStaffCommission, composePayrollSummary, type StaffPayrollLineInput } from "@lotus-desk/core";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard, type AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

const SUMMARY_INCLUDE = {
  summaries: { include: { staff: { select: { name: true, level: true } } } },
} as const;

/**
 * งวดจ่ายค่ามือ (T6.4) — เปิด/ปิดคล้าย CashierShift (T5.7) แต่ "ปิดงวด" คำนวณสรุปยอดต่อพนักงานจริง
 * (ค่ามือจาก ServiceJob ที่จบงานในช่วงงวด + ทิปจาก TipAllocation ที่เกิดในช่วงงวด − หัก (ยังไม่มี requirement
 * จึงเป็น 0 เสมอ) แล้วเขียนลง PayrollPeriodStaffSummary เป็น snapshot ถาวร) "เปิดใหม่" หลังปิดต้องมี PIN
 * ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) กลไกเดียวกับ CashierShift.reopen — ดู BillController.cancel
 * สำหรับ guard 409 จริงที่บล็อกแก้ใบงานย้อนหลังของงวดที่ปิดไปแล้ว
 */
@Controller("branches/:branchId/payroll/periods")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermission("view", "payroll")
  async list(@CurrentBranch() branch: BranchContext) {
    return this.prisma.forBranch(branch.branchId).payrollPeriod.findMany({
      orderBy: { periodStart: "desc" },
      take: 30,
    });
  }

  /**
   * งวดจ่ายที่เปิดอยู่ตอนนี้ (ถ้ามี) — ห่อด้วย `{ period }` เสมอ (ไม่คืน bare `null` ตรง ๆ) เหตุผลเดียวกับ
   * CashierShiftController.current: Nest ส่ง response body ว่างเปล่าเมื่อ handler คืนค่า `null`/`undefined`
   * ตรง ๆ ซึ่งฝั่งเว็บเรียก `res.json()` กับ body ว่างแล้วจะ throw ทันที
   */
  @Get("current")
  @RequirePermission("view", "payroll")
  async current(@CurrentBranch() branch: BranchContext): Promise<{ period: unknown }> {
    const period = await this.prisma.forBranch(branch.branchId).payrollPeriod.findFirst({
      where: { closedAt: null },
      orderBy: { periodStart: "desc" },
    });
    return { period };
  }

  @Post()
  @RequirePermission("manage", "payroll")
  @AuditEntity("PayrollPeriod")
  async open(@CurrentBranch() branch: BranchContext, @CurrentUser() user: AuthenticatedUser) {
    const openPeriod = await this.prisma.client.payrollPeriod.findFirst({
      where: { branchId: branch.branchId, closedAt: null },
    });
    if (openPeriod) {
      throw new ConflictException("มีงวดจ่ายที่เปิดอยู่แล้วในสาขานี้ — ปิดงวดเดิมก่อนเปิดงวดใหม่");
    }
    return this.prisma.client.payrollPeriod.create({
      data: { branchId: branch.branchId, openedByUserId: user.sub, periodStart: new Date() },
    });
  }

  /**
   * ปิดงวดจ่าย (T6.4) — server คำนวณสรุปยอดต่อพนักงานเองทั้งหมด ไม่รับตัวเลขจาก client เลย:
   *  1. ค่ามือ: ดึงทุก ServiceJob ที่จบงานแล้วของสาขานี้ (ไม่กรองช่วงเวลาใน query — ปล่อยให้
   *     calculateStaffCommission ของ packages/core กรอง completedAt/voidedAt/ช่วงงวดเองที่เดียว)
   *  2. ทิป: รวม TipAllocation ที่เกิดในช่วง [periodStart, now) ต่อพนักงาน
   *  3. รวมทั้งสองเข้า StaffPayrollLineInput (deductionSatang = 0 เสมอ — ยังไม่มี requirement) แล้ว
   *     composePayrollSummary คำนวณ totalSatang
   *  4. upsert (ไม่ใช่ create) หนึ่งแถวต่อพนักงานต่อ payroll period — ใช้ upsert เพราะงวดเปิดใหม่แล้วปิดซ้ำ
   *     ได้ (ดู reopen ด้านล่าง) ต้องทับสรุปเดิมของพนักงานคนนั้น ไม่ใช่ชนกับ @@unique แล้ว fail หรือทิ้งแถวเก่าไว้
   */
  @Post(":periodId/close")
  @RequirePermission("manage", "payroll")
  @AuditEntity("PayrollPeriod")
  async close(
    @CurrentBranch() branch: BranchContext,
    @Param("periodId") periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const period = await this.findOwned(branch.branchId, periodId);
    if (period.closedAt) {
      throw new ConflictException("งวดจ่ายนี้ปิดไปแล้ว");
    }

    const now = new Date();

    const jobs = await this.prisma.forBranch(branch.branchId).serviceJob.findMany({
      where: { completedAt: { not: null } },
      select: { id: true, staffId: true, commissionSatang: true, completedAt: true, voidedAt: true },
    });
    const commissionBreakdown = calculateStaffCommission({
      jobs: jobs.map((job) => ({
        jobId: job.id,
        staffId: job.staffId,
        commissionSatang: job.commissionSatang,
        completedAt: job.completedAt,
        voidedAt: job.voidedAt,
      })),
      periodStart: period.periodStart,
      periodEnd: now,
    });
    const commissionByStaff = new Map(commissionBreakdown.map((b) => [b.staffId, b]));

    const tipAllocations = await this.prisma.forBranch(branch.branchId).tipAllocation.findMany({
      where: { createdAt: { gte: period.periodStart, lt: now } },
      select: { staffId: true, tipSatang: true },
    });
    const tipByStaff = new Map<string, number>();
    for (const allocation of tipAllocations) {
      tipByStaff.set(allocation.staffId, (tipByStaff.get(allocation.staffId) ?? 0) + allocation.tipSatang);
    }

    const staffIds = new Set<string>([...commissionByStaff.keys(), ...tipByStaff.keys()]);
    const lines: StaffPayrollLineInput[] = [...staffIds].map((staffId) => {
      const commission = commissionByStaff.get(staffId);
      return {
        staffId,
        jobCount: commission?.jobCount ?? 0,
        commissionSatang: commission?.totalCommissionSatang ?? 0,
        tipSatang: tipByStaff.get(staffId) ?? 0,
        deductionSatang: 0,
      };
    });
    const summaryLines = composePayrollSummary(lines);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.payrollPeriod.update({
        where: { id: periodId },
        data: { periodEnd: now, closedAt: now, closedByUserId: user.sub },
      });

      for (const line of summaryLines) {
        await tx.payrollPeriodStaffSummary.upsert({
          where: { payrollPeriodId_staffId: { payrollPeriodId: periodId, staffId: line.staffId } },
          create: {
            branchId: branch.branchId,
            payrollPeriodId: periodId,
            staffId: line.staffId,
            jobCount: line.jobCount,
            commissionSatang: line.commissionSatang,
            tipSatang: line.tipSatang,
            deductionSatang: line.deductionSatang,
            totalSatang: line.totalSatang,
          },
          update: {
            jobCount: line.jobCount,
            commissionSatang: line.commissionSatang,
            tipSatang: line.tipSatang,
            deductionSatang: line.deductionSatang,
            totalSatang: line.totalSatang,
          },
        });
      }
    });

    return this.prisma.client.payrollPeriod.findUnique({ where: { id: periodId }, include: SUMMARY_INCLUDE });
  }

  /**
   * เปิดงวดจ่ายใหม่หลังปิดไปแล้ว (T6.4) — ต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) ไม่ล้าง
   * periodEnd/summaries เดิมทิ้ง (ยังอยู่จนกว่าจะปิดงวดใหม่จริงทับผ่าน upsert ใน close() ด้านบน)
   */
  @Post(":periodId/reopen")
  @RequirePermission("manage", "payroll")
  @AuditEntity("PayrollPeriod")
  async reopen(
    @CurrentBranch() branch: BranchContext,
    @Param("periodId") periodId: string,
    @Body(new ZodValidationPipe(reopenPayrollPeriodSchema)) body: ReopenPayrollPeriodInput,
  ) {
    const approverId = this.authService.verifyManagerApprovalToken(branch.branchId, body.approvalToken);

    const period = await this.findOwned(branch.branchId, periodId);
    if (!period.closedAt) {
      throw new ConflictException("งวดจ่ายนี้เปิดอยู่แล้ว ไม่ต้องเปิดใหม่");
    }

    return this.prisma.client.payrollPeriod.update({
      where: { id: periodId },
      data: { closedAt: null, reopenedAt: new Date(), reopenedByUserId: approverId },
    });
  }

  @Get(":periodId/summary")
  @RequirePermission("view", "payroll")
  async summary(@CurrentBranch() branch: BranchContext, @Param("periodId") periodId: string) {
    await this.findOwned(branch.branchId, periodId);
    return this.prisma.client.payrollPeriod.findUnique({ where: { id: periodId }, include: SUMMARY_INCLUDE });
  }

  /**
   * ส่งออกสรุปงวดจ่ายเป็น CSV (T6.4 "export Excel") — CSV เปิดใน Excel ได้ตรง ๆ ไม่ต้องเพิ่ม dependency
   * ใหม่ (xlsx/exceljs) ตาม CLAUDE.md ข้อ "ห้ามเพิ่ม dependency ใหม่โดยไม่ถาม" นี่คือ endpoint แรกในระบบที่
   * ส่งไฟล์ดาวน์โหลดกลับ — ใช้ @Res({ passthrough: true }) แล้ว set header เอง จากนั้นยัง `return` ค่า string
   * ตรง ๆ ได้ตามปกติ (Nest ส่งค่า return เป็น body ให้หลัง header ที่เรากำหนดเองเมื่อใช้ passthrough: true)
   */
  @Get(":periodId/summary.csv")
  @RequirePermission("view", "payroll")
  async summaryCsv(
    @CurrentBranch() branch: BranchContext,
    @Param("periodId") periodId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    await this.findOwned(branch.branchId, periodId);
    const period = await this.prisma.client.payrollPeriod.findUnique({
      where: { id: periodId },
      include: SUMMARY_INCLUDE,
    });
    if (!period) {
      throw new NotFoundException("ไม่พบงวดจ่ายนี้");
    }

    const header = "staffId,staffName,level,jobCount,commissionSatang,tipSatang,deductionSatang,totalSatang";
    const rows = period.summaries.map((s) =>
      [
        s.staffId,
        `"${s.staff.name.replace(/"/g, '""')}"`,
        s.staff.level,
        s.jobCount,
        s.commissionSatang,
        s.tipSatang,
        s.deductionSatang,
        s.totalSatang,
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", `attachment; filename="payroll-${periodId}.csv"`);
    return csv;
  }

  private async findOwned(branchId: string, periodId: string) {
    const period = await this.prisma.client.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.branchId !== branchId) {
      throw new NotFoundException("ไม่พบงวดจ่ายนี้");
    }
    return period;
  }
}

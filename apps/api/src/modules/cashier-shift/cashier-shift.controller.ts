import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  closeCashierShiftSchema,
  reopenCashierShiftSchema,
  type CloseCashierShiftInput,
  type ReopenCashierShiftInput,
} from "@lotus-desk/contracts";
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

/**
 * รอบกะแคชเชียร์ (T5.7) — เปิด/ปิดทำได้โดยแคชเชียร์เอง (permission เดียวกับออกบิล) แต่ "เปิดใหม่" หลังปิด
 * แล้วต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) ใช้ approval token กลไกเดียวกับยกเลิกบิล (T5.6)
 * checkout ไม่บังคับต้องมีรอบกะเปิดอยู่ (ตัดสินใจในเซสชันนี้ ดู docs/decisions.md ADR-031) — สิ่งที่ถูกบล็อก
 * จริงคือการ "แก้บิลย้อนหลัง" (ยกเลิกบิล) เท่านั้น ดู BillController.cancel สำหรับ guard 409 จริง
 */
@Controller("branches/:branchId/cashier-shifts")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CashierShiftController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermission("view", "billing")
  async list(@CurrentBranch() branch: BranchContext) {
    return this.prisma.forBranch(branch.branchId).cashierShift.findMany({
      orderBy: { openedAt: "desc" },
      take: 30,
    });
  }

  /**
   * รอบกะที่เปิดอยู่ตอนนี้ (ถ้ามี) — ห่อด้วย `{ shift }` เสมอ (ไม่คืน bare `null` ตรง ๆ) เพราะ Nest ส่ง
   * response body ว่างเปล่า (Content-Length: 0) เมื่อ handler คืนค่า `null`/`undefined` ตรง ๆ ซึ่งฝั่งเว็บ
   * เรียก `res.json()` กับ body ว่างแล้วจะ throw ทันที — ห่อ object กันปัญหานี้แบบตรงไปตรงมา
   */
  @Get("current")
  @RequirePermission("view", "billing")
  async current(@CurrentBranch() branch: BranchContext): Promise<{ shift: unknown }> {
    const shift = await this.prisma.forBranch(branch.branchId).cashierShift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
    });
    return { shift };
  }

  @Post()
  @RequirePermission("manage", "billing")
  @AuditEntity("CashierShift")
  async open(@CurrentBranch() branch: BranchContext, @CurrentUser() user: AuthenticatedUser) {
    const openShift = await this.prisma.client.cashierShift.findFirst({
      where: { branchId: branch.branchId, closedAt: null },
    });
    if (openShift) {
      throw new ConflictException("มีรอบกะที่เปิดอยู่แล้วในสาขานี้ — ปิดรอบเดิมก่อนเปิดรอบใหม่");
    }
    return this.prisma.client.cashierShift.create({
      data: { branchId: branch.branchId, openedByUserId: user.sub },
    });
  }

  /**
   * ปิดรอบกะ (T5.7) — server คำนวณยอดเงินสดตามระบบเอง (ผลรวม BillPayment ช่องทาง CASH ของบิลที่ยังไม่ถูก
   * ยกเลิก ในช่วงเวลาที่รอบกะนี้เปิดอยู่) ไม่รับตัวเลขนี้จาก client เด็ดขาด — ถ้ายอดไม่ตรงบังคับกรอกเหตุผล
   */
  @Post(":shiftId/close")
  @RequirePermission("manage", "billing")
  @AuditEntity("CashierShift")
  async close(
    @CurrentBranch() branch: BranchContext,
    @Param("shiftId") shiftId: string,
    @Body(new ZodValidationPipe(closeCashierShiftSchema)) body: CloseCashierShiftInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const shift = await this.findOwned(branch.branchId, shiftId);
    if (shift.closedAt) {
      throw new ConflictException("รอบกะนี้ปิดไปแล้ว");
    }

    const now = new Date();
    const cashAgg = await this.prisma.client.billPayment.aggregate({
      _sum: { amountSatang: true },
      where: {
        branchId: branch.branchId,
        method: "CASH",
        bill: { status: { not: "CANCELLED" }, createdAt: { gte: shift.openedAt, lt: now } },
      },
    });
    const systemCashSatang = cashAgg._sum.amountSatang ?? 0;
    const varianceSatang = body.countedCashSatang - systemCashSatang;

    if (varianceSatang !== 0 && !body.varianceReason) {
      throw new UnprocessableEntityException(
        `ยอดเงินสดที่นับได้ (${body.countedCashSatang} สตางค์) ไม่ตรงกับยอดตามระบบ ` +
          `(${systemCashSatang} สตางค์) กรุณาระบุเหตุผลของส่วนต่าง`,
      );
    }

    return this.prisma.client.cashierShift.update({
      where: { id: shiftId },
      data: {
        closedAt: now,
        closedByUserId: user.sub,
        countedCashSatang: body.countedCashSatang,
        systemCashSatang,
        varianceSatang,
        varianceReason: body.varianceReason ?? null,
      },
    });
  }

  /**
   * เปิดรอบกะใหม่หลังปิดไปแล้ว (T5.7) — ต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) ไม่ล้างค่าปิดรอบ
   * เดิมทิ้ง (closedAt/counted/system/varianceSatang เดิมยังอยู่จนกว่าจะปิดรอบใหม่จริงทับ — ดู ADR-031)
   */
  @Post(":shiftId/reopen")
  @RequirePermission("manage", "billing")
  @AuditEntity("CashierShift")
  async reopen(
    @CurrentBranch() branch: BranchContext,
    @Param("shiftId") shiftId: string,
    @Body(new ZodValidationPipe(reopenCashierShiftSchema)) body: ReopenCashierShiftInput,
  ) {
    const approverId = this.authService.verifyManagerApprovalToken(branch.branchId, body.approvalToken);

    const shift = await this.findOwned(branch.branchId, shiftId);
    if (!shift.closedAt) {
      throw new ConflictException("รอบกะนี้เปิดอยู่แล้ว ไม่ต้องเปิดใหม่");
    }

    return this.prisma.client.cashierShift.update({
      where: { id: shiftId },
      data: { closedAt: null, reopenedAt: new Date(), reopenedByUserId: approverId },
    });
  }

  private async findOwned(branchId: string, shiftId: string) {
    const shift = await this.prisma.client.cashierShift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.branchId !== branchId) {
      throw new NotFoundException("ไม่พบรอบกะนี้");
    }
    return shift;
  }
}

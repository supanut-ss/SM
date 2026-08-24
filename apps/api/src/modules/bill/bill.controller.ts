import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  checkoutBillSchema,
  cancelBillSchema,
  type CheckoutBillInput,
  type CancelBillInput,
} from "@lotus-desk/contracts";
import { evaluatePromotions, validateRefund, validateUse } from "@lotus-desk/core";
import { Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { bangkokDayOfWeek, bangkokMinuteOfDay, bangkokMonth } from "../promotion/bangkok-time";
import { resolveUsablePromotions, toPromotionRule } from "../promotion/promotion-rules";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { MemberPackageService } from "../member-package/member-package.service";
import type { BranchContext } from "../rbac/permission.guard";

const BILL_INCLUDE = {
  lines: { include: { serviceJob: { include: { serviceVariant: { include: { service: true } } } } } },
  payments: true,
} as const;

const BILL_NUMBER_ATTEMPTS = 5;

/**
 * บิล (T5.6) — รวมใบงาน (ServiceJob, T5.5) + รายการสินค้าอิสระเข้าบิลเดียว จ่ายได้หลายช่องทาง
 * โปรโมชั่นคำนวณอัตโนมัติฝั่ง server เสมอ (เรียก evaluatePromotions ของ T5.3 จริง ไม่รับตัวเลขจาก client)
 * ยกเลิกบิลต้องมี PIN ผู้จัดการ (approvalToken จาก POST /auth/verify-manager-pin) — คืนยอดคอร์ส/โควตาโปรฯ/
 * ทำใบงานเป็นโมฆะครบทุกรายการในทรานแซกชันเดียว ดู docs/decisions.md ADR-030
 */
@Controller("branches/:branchId/bills")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberPackageService: MemberPackageService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermission("view", "billing")
  async list(@CurrentBranch() branch: BranchContext, @Query("memberId") memberId?: string) {
    return this.prisma.forBranch(branch.branchId).bill.findMany({
      where: memberId ? { memberId } : {},
      include: BILL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  @Get(":billId")
  @RequirePermission("view", "billing")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("billId") billId: string) {
    return this.findOwned(branch.branchId, billId);
  }

  /**
   * เช็คเอาต์ (T5.6) — ใบงานต้อง COMPLETED แล้วเท่านั้นถึงออกบิลได้ (1 ใบงานอยู่ได้บิลเดียว) แหล่งชำระของ
   * แต่ละใบงานอ่านจาก ServiceJob.paymentMethod ที่ตัดสินใจไว้แล้วตอนจบงาน (ดู ADR-029) ไม่ถามซ้ำ — โปรฯ
   * เดียวต่อบิล (docs/DOMAIN.md ข้อ 15) เลือกอัตโนมัติจาก evaluatePromotions เสมอ
   */
  @Post()
  @RequirePermission("manage", "billing")
  @AuditEntity("Bill")
  async checkout(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(checkoutBillSchema)) body: CheckoutBillInput,
  ) {
    if (body.memberId) {
      const member = await this.prisma.client.member.findUnique({ where: { id: body.memberId } });
      if (!member || member.branchId !== branch.branchId) {
        throw new NotFoundException("ไม่พบสมาชิกนี้ในสาขานี้");
      }
    }

    const serviceJobEntries = await Promise.all(
      body.serviceJobLines.map(async (line) => {
        const job = await this.prisma.client.serviceJob.findUnique({
          where: { id: line.serviceJobId },
          include: { serviceVariant: { include: { service: true } }, billLine: true },
        });
        if (!job || job.branchId !== branch.branchId) {
          throw new NotFoundException(`ไม่พบใบงาน ${line.serviceJobId} ในสาขานี้`);
        }
        if (!job.completedAt || !job.paymentMethod) {
          throw new UnprocessableEntityException("ใบงานนี้ยังไม่จบงาน ออกบิลไม่ได้");
        }
        if (job.billLine) {
          throw new ConflictException("ใบงานนี้ถูกออกบิลไปแล้ว");
        }
        if (job.paymentMethod === "PACKAGE" && !line.memberPackageId) {
          throw new UnprocessableEntityException("ใบงานนี้จ่ายด้วยการตัดคอร์ส ต้องระบุคอร์สที่จะตัด");
        }
        return { job, memberPackageId: line.memberPackageId };
      }),
    );

    const cart = [
      ...serviceJobEntries.map(({ job }) => ({
        serviceVariantId: job.serviceVariantId,
        priceSatang: job.priceSatang,
        paymentMethod: job.paymentMethod!,
        quantity: 1,
      })),
      ...body.productLines.map((p) => ({
        serviceVariantId: `product:${p.description}`,
        priceSatang: p.priceSatang,
        paymentMethod: p.paymentMethod,
        quantity: p.quantity,
      })),
    ];

    const { usablePromotions } = await resolveUsablePromotions(this.prisma, branch.branchId, body.couponCode);
    const now = new Date();
    const promoResult = evaluatePromotions({
      dayOfWeek: bangkokDayOfWeek(now),
      minuteOfDay: bangkokMinuteOfDay(now),
      currentMonth: bangkokMonth(now),
      branchId: branch.branchId,
      memberTier: body.memberTier ?? null,
      isFirstTimeCustomer: body.isFirstTimeCustomer,
      memberBirthMonth: body.memberBirthMonth ?? null,
      cart,
      promotions: usablePromotions.map(toPromotionRule),
    });

    const subtotalSatang = cart.reduce((sum, l) => sum + l.priceSatang * l.quantity, 0);
    const discountSatang = promoResult.applied?.discountSatang ?? 0;
    const totalSatang = subtotalSatang - discountSatang;

    const paymentsTotal = body.payments.reduce((sum, p) => sum + p.amountSatang, 0);
    if (paymentsTotal !== totalSatang) {
      throw new UnprocessableEntityException(
        `ยอดชำระรวม (${paymentsTotal} สตางค์) ไม่ตรงกับยอดบิล (${totalSatang} สตางค์)`,
      );
    }
    for (const p of body.payments) {
      if (p.tenderedSatang !== undefined && p.tenderedSatang < p.amountSatang) {
        throw new UnprocessableEntityException("จำนวนเงินที่รับมาต้องไม่น้อยกว่ายอดที่ต้องชำระในช่องทางนั้น");
      }
    }

    try {
      const billId = await this.prisma.client.$transaction(async (tx) => {
        const billNumber = await this.generateBillNumber(tx, branch.branchId);
        const bill = await tx.bill.create({
          data: {
            branchId: branch.branchId,
            memberId: body.memberId ?? null,
            billNumber,
            subtotalSatang,
            promotionId: promoResult.applied?.promotionId ?? null,
            discountSatang,
            totalSatang,
          },
        });

        for (const { job, memberPackageId } of serviceJobEntries) {
          const line = await tx.billLine.create({
            data: {
              branchId: branch.branchId,
              billId: bill.id,
              kind: "SERVICE_JOB",
              serviceJobId: job.id,
              description: `${job.serviceVariant.service.name} (${job.serviceVariant.durationMin} นาที)`,
              priceSatang: job.priceSatang,
              quantity: 1,
              paymentMethod: job.paymentMethod!,
              memberPackageId: memberPackageId ?? null,
            },
          });

          if (job.paymentMethod === "PACKAGE") {
            await this.memberPackageService.lock(tx, memberPackageId!);
            const memberPackage = await tx.memberPackage.findUnique({ where: { id: memberPackageId! } });
            if (!memberPackage || memberPackage.branchId !== branch.branchId) {
              throw new NotFoundException("ไม่พบคอร์สนี้ในสาขานี้");
            }
            if (!body.memberId || memberPackage.memberId !== body.memberId) {
              throw new UnprocessableEntityException("คอร์สนี้ไม่ใช่ของสมาชิกที่เลือกไว้ในบิล");
            }
            if (memberPackage.type !== "VALUE" && memberPackage.serviceVariantId !== job.serviceVariantId) {
              throw new UnprocessableEntityException("คอร์สนี้ใช้กับบริการนี้ไม่ได้");
            }

            const balance = await this.memberPackageService.getBalance(tx, memberPackageId!);
            const amount = memberPackage.type === "VALUE" ? job.priceSatang : 1;
            const result = validateUse({
              packageType: memberPackage.type,
              currentBalance: balance,
              amount,
              now,
              expiresAt: memberPackage.expiresAt,
              approvedByUserId: null,
            });
            if (!result.ok) throw new UnprocessableEntityException(result.reason);

            const delta = memberPackage.type === "UNLIMITED_DURATION" ? 0 : -amount;
            const ledgerEntry = await tx.memberPackageLedgerEntry.create({
              data: {
                branchId: branch.branchId,
                memberPackageId: memberPackageId!,
                kind: "USE",
                delta,
                note: `ตัดจากบิล ${billNumber}`,
              },
            });
            await tx.billLine.update({
              where: { id: line.id },
              data: { memberPackageLedgerEntryId: ledgerEntry.id },
            });
          }
        }

        for (const p of body.productLines) {
          await tx.billLine.create({
            data: {
              branchId: branch.branchId,
              billId: bill.id,
              kind: "PRODUCT",
              description: p.description,
              priceSatang: p.priceSatang,
              quantity: p.quantity,
              paymentMethod: p.paymentMethod,
            },
          });
        }

        for (const p of body.payments) {
          await tx.billPayment.create({
            data: {
              branchId: branch.branchId,
              billId: bill.id,
              method: p.method,
              amountSatang: p.amountSatang,
              tenderedSatang: p.tenderedSatang,
            },
          });
        }

        if (promoResult.applied) {
          await tx.promotion.update({
            where: { id: promoResult.applied.promotionId },
            data: { quotaUsed: { increment: 1 } },
          });
        }

        return bill.id;
      });

      return this.findOwned(branch.branchId, billId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("ใบงานบางรายการถูกออกบิลไปแล้วพอดี กรุณาลองใหม่");
      }
      throw err;
    }
  }

  /**
   * ยกเลิกบิล (T5.6) — ต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 14) คืนยอดคอร์สที่ตัดไปแล้ว + คืนโควตา
   * โปรฯ + ทำใบงานที่ผูกอยู่เป็นโมฆะ (voidedAt) ครบทุกรายการในทรานแซกชันเดียว (เกณฑ์ผ่าน T5.6)
   */
  @Post(":billId/cancel")
  @RequirePermission("manage", "billing")
  @AuditEntity("Bill")
  async cancel(
    @CurrentBranch() branch: BranchContext,
    @Param("billId") billId: string,
    @Body(new ZodValidationPipe(cancelBillSchema)) body: CancelBillInput,
  ) {
    const approverId = this.authService.verifyManagerApprovalToken(branch.branchId, body.approvalToken);

    const bill = await this.findOwned(branch.branchId, billId);
    if (bill.status === "CANCELLED") {
      throw new ConflictException("บิลนี้ถูกยกเลิกไปแล้ว");
    }

    await this.prisma.client.$transaction(async (tx) => {
      for (const line of bill.lines) {
        if (line.memberPackageLedgerEntryId) {
          await this.memberPackageService.lock(tx, line.memberPackageId!);
          const originalEntry = await tx.memberPackageLedgerEntry.findUnique({
            where: { id: line.memberPackageLedgerEntryId },
          });
          if (!originalEntry) continue; // ไม่ควรเกิดขึ้นจริง — กันพังไว้เฉย ๆ
          const memberPackage = await tx.memberPackage.findUniqueOrThrow({
            where: { id: line.memberPackageId! },
          });
          const result = validateRefund({
            originalUseDelta: originalEntry.delta,
            memberPackageStatus: memberPackage.status,
          });
          if (!result.ok) {
            throw new UnprocessableEntityException(
              `คืนยอดคอร์สของรายการ "${line.description}" ไม่ได้: ${result.reason}`,
            );
          }
          await tx.memberPackageLedgerEntry.create({
            data: {
              branchId: branch.branchId,
              memberPackageId: line.memberPackageId!,
              kind: "REFUND",
              delta: -originalEntry.delta,
              note: `คืนยอดจากการยกเลิกบิล ${bill.billNumber}: ${body.reason}`,
              relatedEntryId: originalEntry.id,
            },
          });
        }

        if (line.serviceJobId) {
          await tx.serviceJob.update({ where: { id: line.serviceJobId }, data: { voidedAt: new Date() } });
        }
      }

      if (bill.promotionId) {
        const promotion = await tx.promotion.findUnique({ where: { id: bill.promotionId } });
        if (promotion && promotion.quotaUsed > 0) {
          await tx.promotion.update({ where: { id: bill.promotionId }, data: { quotaUsed: { decrement: 1 } } });
        }
      }

      await tx.bill.update({
        where: { id: billId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledReason: body.reason,
          cancelledByUserId: approverId,
        },
      });
    });

    return this.findOwned(branch.branchId, billId);
  }

  private async findOwned(branchId: string, billId: string) {
    const bill = await this.prisma.client.bill.findUnique({ where: { id: billId }, include: BILL_INCLUDE });
    if (!bill || bill.branchId !== branchId) {
      throw new NotFoundException("ไม่พบบิลนี้");
    }
    return bill;
  }

  /** เลขบิลอ่านง่ายรันต่อสาขา เช่น "B000123" — แพทเทิร์นเดียวกับ MemberController.createWithGeneratedCode (T3.1) */
  private async generateBillNumber(tx: Prisma.TransactionClient, branchId: string): Promise<string> {
    for (let attempt = 0; attempt < BILL_NUMBER_ATTEMPTS; attempt++) {
      const count = await tx.bill.count({ where: { branchId } });
      const billNumber = `B${(count + 1 + attempt).toString().padStart(6, "0")}`;
      const existing = await tx.bill.findUnique({ where: { branchId_billNumber: { branchId, billNumber } } });
      if (!existing) return billNumber;
    }
    throw new ConflictException("ไม่สามารถสร้างเลขบิลใหม่ได้ กรุณาลองใหม่อีกครั้ง");
  }
}

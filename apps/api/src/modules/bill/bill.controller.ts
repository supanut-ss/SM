import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  checkoutBillSchema,
  cancelBillSchema,
  recordBillTipSchema,
  type CheckoutBillInput,
  type CancelBillInput,
  type RecordBillTipInput,
} from "@lotus-desk/contracts";
import { evaluatePromotions, splitTipsEqually, validateRefund, validateUse } from "@lotus-desk/core";
import { Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard, type AuthenticatedUser } from "../auth/jwt-auth.guard";
import { bangkokDayOfWeek, bangkokMinuteOfDay, bangkokMonth } from "../promotion/bangkok-time";
import { resolveUsablePromotions, toPromotionRule } from "../promotion/promotion-rules";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { MemberPackageService } from "../member-package/member-package.service";
import type { BranchContext } from "../rbac/permission.guard";
import { bangkokDayRange, toBangkokDateOnly } from "./bangkok-time";

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
   * แต่ละใบงานอ่านจาก ServiceJob.paymentMethod ที่ตัดสินใจไว้แล้วตอนเริ่มงาน (ดู docs/decisions.md ADR-046
   * ที่พลิกกลับ ADR-029 ข้อ 4) ไม่ถามซ้ำ — คอร์สที่จะตัดก็อ่านจาก ServiceJob.memberPackageId ที่ล็อกไว้ตอน
   * เริ่มงานเช่นกัน ไม่รับจาก client อีกต่อไป (client เป็นแค่ตัวเลือกที่ล้าสมัยได้ ServiceJob เท่านั้นคือ
   * แหล่งความจริง) โปรฯ เดียวต่อบิล (docs/DOMAIN.md ข้อ 15) เลือกอัตโนมัติจาก evaluatePromotions เสมอ
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
        // memberPackageId เป็นแหล่งความจริงจาก ServiceJob (ล็อกไว้ตอนเริ่มงานแล้ว) ไม่ใช่จาก client อีกต่อไป
        // — เช็คป้องกันไว้เผื่อแถวเก่าก่อน migration นี้ที่ paymentMethod=PACKAGE แต่ไม่มี memberPackageId
        if (job.paymentMethod === "PACKAGE" && !job.memberPackageId) {
          throw new UnprocessableEntityException("ใบงานนี้จ่ายด้วยการตัดคอร์ส แต่ไม่มีคอร์สที่ล็อกไว้ตอนเริ่มงาน");
        }
        return { job, memberPackageId: job.memberPackageId };
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
   * ยกเลิกบิล (T5.6) — ปกติต้องมี PIN ผู้จัดการ (docs/DOMAIN.md ข้อ 14) คืนยอดคอร์สที่ตัดไปแล้ว + คืนโควตา
   * โปรฯ + ทำใบงานที่ผูกอยู่เป็นโมฆะ (voidedAt) ครบทุกรายการในทรานแซกชันเดียว (เกณฑ์ผ่าน T5.6)
   *
   * ข้อยกเว้น (นโยบายเจ้าของร้าน, ตัดสินใจแล้ว): แคชเชียร์ยกเลิกบิลเองได้โดยไม่ต้องมี PIN ผู้จัดการ ถ้าเข้า
   * เงื่อนไขทั้งสองข้อพร้อมกัน — (1) บิลออกมาไม่เกิน 10 นาที คือรีบแก้ความผิดพลาดที่เพิ่งเกิด ไม่ใช่เปิดบิล
   * เก่าย้อนหลัง และ (2) บิลนี้ไม่มีรายการไหนตัดคอร์สสมาชิกเลย เพราะการคืนยอดคอร์สมีผลกระทบมากกว่า ต้องผ่าน
   * ผู้จัดการเสมอไม่มีข้อยกเว้น ถ้าแนบ approvalToken มาด้วย ผู้จัดการ override/อนุมัติได้เสมอไม่ว่าจะเข้าเงื่อนไข
   * ยกเว้นหรือไม่ (เส้นทางเดิม ไม่เปลี่ยนพฤติกรรม)
   */
  @Post(":billId/cancel")
  @RequirePermission("manage", "billing")
  @AuditEntity("Bill")
  async cancel(
    @CurrentBranch() branch: BranchContext,
    @Param("billId") billId: string,
    @Body(new ZodValidationPipe(cancelBillSchema)) body: CancelBillInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const bill = await this.findOwned(branch.branchId, billId);
    if (bill.status === "CANCELLED") {
      throw new ConflictException("บิลนี้ถูกยกเลิกไปแล้ว");
    }

    const SELF_CANCEL_WINDOW_MS = 10 * 60 * 1000; // ยกเลิกบิลเองได้ถ้าอยู่ในกำหนดนี้และไม่ตัดคอร์ส (นโยบายเจ้าของร้าน)
    const touchesPackage = bill.lines.some((line) => line.memberPackageLedgerEntryId !== null);
    const withinSelfCancelWindow = Date.now() - bill.createdAt.getTime() <= SELF_CANCEL_WINDOW_MS;
    const selfCancelEligible = withinSelfCancelWindow && !touchesPackage;

    let approverId: string;
    if (body.approvalToken) {
      approverId = this.authService.verifyManagerApprovalToken(branch.branchId, body.approvalToken);
    } else if (selfCancelEligible) {
      approverId = user.sub;
    } else if (touchesPackage) {
      throw new UnauthorizedException(
        "บิลนี้มีรายการตัดคอร์สสมาชิก ยกเลิกเองไม่ได้ ต้องให้ผู้จัดการกรอก PIN อนุมัติก่อนเสมอ",
      );
    } else {
      throw new UnauthorizedException(
        "บิลนี้ออกมาเกิน 10 นาทีแล้ว ยกเลิกเองไม่ได้ ต้องให้ผู้จัดการกรอก PIN อนุมัติก่อน",
      );
    }

    // รอบกะที่ "ครอบ" ช่วงเวลาที่บิลนี้ถูกสร้าง (T5.7) — ไม่มี Bill.shiftId ตรง ๆ เพราะ checkout ไม่บังคับ
    // ต้องมีรอบกะเปิดอยู่ (ดู docs/decisions.md ADR-031) หาจากช่วงเวลาแทน ถ้ารอบกะนั้นปิดไปแล้วต้องให้
    // ผู้จัดการเปิดใหม่ก่อนถึงจะยกเลิกบิลได้ (docs/DOMAIN.md ข้อ 16)
    const governingShift = await this.prisma.client.cashierShift.findFirst({
      where: {
        branchId: branch.branchId,
        openedAt: { lte: bill.createdAt },
        OR: [{ closedAt: null }, { closedAt: { gte: bill.createdAt } }],
      },
      orderBy: { openedAt: "desc" },
    });
    if (governingShift?.closedAt) {
      throw new ConflictException(
        "บิลนี้อยู่ในรอบกะที่ปิดไปแล้ว ต้องให้ผู้จัดการเปิดรอบกะนี้ใหม่ก่อนถึงจะยกเลิกบิลได้",
      );
    }

    // งวดจ่ายค่ามือที่ "ครอบ" ช่วงเวลาที่บิลนี้ถูกสร้าง (T6.4) — หลักการเดียวกับ governingShift ด้านบน
    // (หาจากช่วงเวลาแทน ไม่มี FK ตรง ๆ) ถ้างวดนั้นปิดไปแล้วต้องให้ผู้จัดการเปิดใหม่ก่อนถึงจะยกเลิกบิลได้
    // (เกณฑ์ผ่าน T6.4: "ปิดงวดแล้วแก้ใบงานย้อนหลังต้องถูกปฏิเสธ")
    const governingPayrollPeriod = await this.prisma.client.payrollPeriod.findFirst({
      where: {
        branchId: branch.branchId,
        periodStart: { lte: bill.createdAt },
        OR: [{ periodEnd: null }, { periodEnd: { gte: bill.createdAt } }],
      },
      orderBy: { periodStart: "desc" },
    });
    if (governingPayrollPeriod?.closedAt) {
      throw new ConflictException(
        "บิลนี้อยู่ในงวดจ่ายค่ามือที่ปิดไปแล้ว ต้องให้ผู้จัดการเปิดงวดนี้ใหม่ก่อนถึงจะยกเลิกบิลได้",
      );
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

  /**
   * บันทึกทิป (T6.3) — เข้ากองกลางพนักงานทุกคนเสมอ ไม่ใช่ของพนักงานคนใดคนหนึ่ง (docs/DOMAIN.md ข้อ 12)
   * เกณฑ์แบ่ง (ชั่วคราว, ดู docs/decisions.md ADR-032): หารเท่า ๆ กันให้พนักงานทุกคนที่มี TimeClockEntry
   * คลุมวันปฏิทินไทยเดียวกับตอนที่บิลนี้ checkout (Bill.createdAt) ที่สาขาเดียวกัน — คำนวณแบ่งทันทีตอน
   * บันทึกทิป ไม่รอถึงตอนปิดงวดจ่าย (T6.4 อ่านผลรวมจาก TipAllocation ตรง ๆ)
   */
  @Post(":billId/tips")
  @RequirePermission("manage", "billing")
  @AuditEntity("BillTip")
  async recordTip(
    @CurrentBranch() branch: BranchContext,
    @Param("billId") billId: string,
    @Body(new ZodValidationPipe(recordBillTipSchema)) body: RecordBillTipInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const bill = await this.findOwned(branch.branchId, billId);
    if (bill.status === "CANCELLED") {
      throw new ConflictException("บิลนี้ถูกยกเลิกไปแล้ว บันทึกทิปไม่ได้");
    }

    const existingTip = await this.prisma.client.billTip.findUnique({ where: { billId } });
    if (existingTip) {
      throw new ConflictException("บิลนี้บันทึกทิปไปแล้ว");
    }

    const billDay = toBangkokDateOnly(bill.createdAt);
    const { start, end } = bangkokDayRange(billDay);
    const clockedInStaff = await this.prisma.forBranch(branch.branchId).timeClockEntry.findMany({
      where: { clockInAt: { gte: start, lt: end } },
      select: { staffId: true },
    });
    const staffIds = [...new Set(clockedInStaff.map((e) => e.staffId))].sort();
    if (staffIds.length === 0) {
      throw new UnprocessableEntityException(
        "ไม่มีพนักงานลงเวลาทำงานในวันที่บิลนี้เกิดขึ้น ไม่สามารถแบ่งทิปได้",
      );
    }

    const totalTipSatang = body.cashSatang + body.transferSatang;
    const allocationPlan = splitTipsEqually({ totalTipSatang, staffIds });

    const { billTip, allocations } = await this.prisma.client.$transaction(async (tx) => {
      const createdTip = await tx.billTip.create({
        data: {
          branchId: branch.branchId,
          billId: bill.id,
          cashSatang: body.cashSatang,
          transferSatang: body.transferSatang,
          createdByUserId: user.sub,
        },
      });

      const createdAllocations = [];
      for (const plan of allocationPlan) {
        const allocation = await tx.tipAllocation.create({
          data: {
            branchId: branch.branchId,
            billTipId: createdTip.id,
            staffId: plan.staffId,
            tipSatang: plan.tipSatang,
          },
        });
        createdAllocations.push(allocation);
      }

      return { billTip: createdTip, allocations: createdAllocations };
    });

    return { id: billTip.id, tip: billTip, allocations };
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

import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { calculatePromotionsSchema, type CalculatePromotionsInput } from "@lotus-desk/contracts";
import { evaluatePromotions, type PromotionRule } from "@lotus-desk/core";
import type { Coupon, Promotion } from "@lotus-desk/db";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { bangkokDayOfWeek, bangkokMinuteOfDay, bangkokMonth } from "./bangkok-time";
import type { BranchContext } from "../rbac/permission.guard";

function toPromotionRule(promotion: Promotion): PromotionRule {
  return {
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    priority: promotion.priority,
    percentOff: promotion.percentOff ?? undefined,
    amountOffSatang: promotion.amountOffSatang ?? undefined,
    fixedPriceSatang: promotion.fixedPriceSatang ?? undefined,
    buyQuantity: promotion.buyQuantity ?? undefined,
    getQuantity: promotion.getQuantity ?? undefined,
    bonusMinutes: promotion.bonusMinutes ?? undefined,
    conditions: {
      minSpendSatang: promotion.minSpendSatang ?? undefined,
      serviceVariantIds: promotion.serviceVariantIds.length > 0 ? promotion.serviceVariantIds : undefined,
      daysOfWeek: promotion.daysOfWeek.length > 0 ? promotion.daysOfWeek : undefined,
      startMinuteOfDay: promotion.startMinuteOfDay ?? undefined,
      endMinuteOfDay: promotion.endMinuteOfDay ?? undefined,
      firstTimeCustomerOnly: promotion.firstTimeCustomerOnly,
      birthdayMonthOnly: promotion.birthdayMonthOnly,
      memberTiers: promotion.memberTiers.length > 0 ? promotion.memberTiers : undefined,
    },
    quotaRemaining: promotion.quotaTotal === null ? null : Math.max(0, promotion.quotaTotal - promotion.quotaUsed),
  };
}

/**
 * หน้าทดลองคำนวณ (T5.4) — "ใส่ตะกร้าจำลองแล้วดูว่าโปรฯ ไหนจับ ลดเท่าไร เพราะอะไร" ไม่บันทึกอะไรลง DB เลย
 * เรียก evaluatePromotions (T5.3) จริงตรง ๆ ด้วยโปรโมชั่นที่ active ทั้งหมดของสาขา — โปรฯ ที่ไม่มีคูปองผูก
 * เลยถือเป็น "อัตโนมัติ" ประเมินเสมอ ส่วนโปรฯ ที่มีคูปองผูกไว้จะถูกพิจารณาก็ต่อเมื่อกรอกรหัสคูปองที่ตรงและ
 * ยังใช้ได้เท่านั้น (ดู docs/decisions.md ADR-028)
 */
@Controller("branches/:branchId/promotions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PromotionCalculatorController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("calculate")
  @RequirePermission("view", "promotion")
  async calculate(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(calculatePromotionsSchema)) body: CalculatePromotionsInput,
  ) {
    const activePromotions = await this.prisma.client.promotion.findMany({
      where: { branchId: branch.branchId, isActive: true },
      include: { coupons: true },
    });

    let couponError: string | null = null;
    const usablePromotions: Array<Promotion & { coupons: Coupon[] }> = [];
    for (const promotion of activePromotions) {
      if (promotion.coupons.length === 0) {
        usablePromotions.push(promotion);
        continue;
      }
      const matchedCoupon = body.couponCode
        ? promotion.coupons.find((c) => c.code === body.couponCode)
        : undefined;
      if (!matchedCoupon) continue;
      if (!matchedCoupon.isActive) {
        couponError = "รหัสคูปองนี้ถูกปิดใช้งานแล้ว";
        continue;
      }
      if (matchedCoupon.maxRedemptions !== null && matchedCoupon.redeemedCount >= matchedCoupon.maxRedemptions) {
        couponError = "รหัสคูปองนี้ถูกใช้ครบจำนวนแล้ว";
        continue;
      }
      usablePromotions.push(promotion);
    }
    if (body.couponCode && !usablePromotions.some((p) => p.coupons.some((c) => c.code === body.couponCode))) {
      couponError ??= "ไม่พบรหัสคูปองนี้ หรือใช้กับโปรโมชั่นใดไม่ได้แล้ว";
    }

    const now = new Date();
    const result = evaluatePromotions({
      dayOfWeek: bangkokDayOfWeek(now),
      minuteOfDay: bangkokMinuteOfDay(now),
      currentMonth: bangkokMonth(now),
      branchId: branch.branchId,
      memberTier: body.memberTier ?? null,
      isFirstTimeCustomer: body.isFirstTimeCustomer,
      memberBirthMonth: body.memberBirthMonth ?? null,
      cart: body.cart,
      promotions: usablePromotions.map(toPromotionRule),
    });

    return { ...result, couponError };
  }
}

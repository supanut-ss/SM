import type { PromotionRule } from "@lotus-desk/core";
import type { Coupon, Promotion } from "@lotus-desk/db";
import type { PrismaService } from "../../prisma/prisma.service";

export function toPromotionRule(promotion: Promotion): PromotionRule {
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
 * โปรฯ ที่ไม่มีคูปองผูกเลย = อัตโนมัติ (ใช้ได้เสมอถ้าเข้าเงื่อนไข) โปรฯ ที่มีคูปองผูกไว้อย่างน้อย 1 ใบ
 * จะถูกพิจารณาก็ต่อเมื่อกรอกรหัสคูปองที่ตรงและยังใช้ได้เท่านั้น (ดู docs/decisions.md ADR-028) ใช้ร่วมกัน
 * ระหว่างหน้าทดลองคำนวณ (T5.4) กับ checkout บิลจริง (T5.6) เพื่อไม่ให้ตรรกะเรื่องเงินสองที่ไม่ตรงกัน
 */
export async function resolveUsablePromotions(
  prisma: PrismaService,
  branchId: string,
  couponCode: string | undefined,
): Promise<{ usablePromotions: Array<Promotion & { coupons: Coupon[] }>; couponError: string | null }> {
  const activePromotions = await prisma.client.promotion.findMany({
    where: { branchId, isActive: true },
    include: { coupons: true },
  });

  let couponError: string | null = null;
  const usablePromotions: Array<Promotion & { coupons: Coupon[] }> = [];
  for (const promotion of activePromotions) {
    if (promotion.coupons.length === 0) {
      usablePromotions.push(promotion);
      continue;
    }
    const matchedCoupon = couponCode ? promotion.coupons.find((c) => c.code === couponCode) : undefined;
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
  if (couponCode && !usablePromotions.some((p) => p.coupons.some((c) => c.code === couponCode))) {
    couponError ??= "ไม่พบรหัสคูปองนี้ หรือใช้กับโปรโมชั่นใดไม่ได้แล้ว";
  }

  return { usablePromotions, couponError };
}

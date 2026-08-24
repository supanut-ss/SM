import type { CreatePromotionInput, PromotionFormInput, PromotionType } from "@lotus-desk/contracts";

export const EMPTY_PROMOTION_FORM_VALUES: Record<PromotionType, PromotionFormInput> = {
  PERCENT_OFF: { type: "PERCENT_OFF", name: "", priority: 0, percentOff: 10 },
  AMOUNT_OFF: { type: "AMOUNT_OFF", name: "", priority: 0, amountOffBaht: 100 },
  FIXED_PRICE: { type: "FIXED_PRICE", name: "", priority: 0, fixedPriceBaht: 199 },
  BUY_X_GET_Y: { type: "BUY_X_GET_Y", name: "", priority: 0, buyQuantity: 2, getQuantity: 1 },
  BONUS_MINUTES: { type: "BONUS_MINUTES", name: "", priority: 0, bonusMinutes: 15 },
};

/** บาท → สตางค์ ปัดเศษเข้าจำนวนเต็มที่ใกล้ที่สุดเสมอ (กัน float error ตกค้างก่อนเข้า DB) */
export function promotionFormToApiInput(values: PromotionFormInput): CreatePromotionInput {
  const shared = {
    name: values.name,
    priority: values.priority,
    quotaTotal: values.quotaTotal,
    minSpendSatang: values.minSpendBaht !== undefined ? Math.round(values.minSpendBaht * 100) : undefined,
    serviceVariantIds: values.serviceVariantIds,
    daysOfWeek: values.daysOfWeek,
    startMinuteOfDay: values.startMinuteOfDay,
    endMinuteOfDay: values.endMinuteOfDay,
    firstTimeCustomerOnly: values.firstTimeCustomerOnly,
    birthdayMonthOnly: values.birthdayMonthOnly,
    memberTiers: values.memberTiers,
  };
  if (values.type === "PERCENT_OFF") {
    return { type: "PERCENT_OFF", ...shared, percentOff: values.percentOff };
  }
  if (values.type === "AMOUNT_OFF") {
    return { type: "AMOUNT_OFF", ...shared, amountOffSatang: Math.round(values.amountOffBaht * 100) };
  }
  if (values.type === "FIXED_PRICE") {
    return { type: "FIXED_PRICE", ...shared, fixedPriceSatang: Math.round(values.fixedPriceBaht * 100) };
  }
  if (values.type === "BUY_X_GET_Y") {
    return { type: "BUY_X_GET_Y", ...shared, buyQuantity: values.buyQuantity, getQuantity: values.getQuantity };
  }
  return { type: "BONUS_MINUTES", ...shared, bonusMinutes: values.bonusMinutes };
}

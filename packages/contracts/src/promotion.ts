import { z } from "zod";

/** เงินทุกฟิลด์เก็บเป็น integer สตางค์เสมอ (ดู CLAUDE.md ข้อ 2) ห้ามใช้ float */
function moneySatang(label: string) {
  return z.coerce
    .number()
    .int(`${label}ต้องเป็นจำนวนเต็ม (หน่วยสตางค์)`)
    .min(0, `${label}ต้องไม่ติดลบ`);
}

export const PROMOTION_TYPES = [
  "PERCENT_OFF",
  "AMOUNT_OFF",
  "FIXED_PRICE",
  "BUY_X_GET_Y",
  "BONUS_MINUTES",
] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PROMOTION_TYPE_LABEL: Record<PromotionType, string> = {
  PERCENT_OFF: "ลดเปอร์เซ็นต์",
  AMOUNT_OFF: "ลดเป็นบาท",
  FIXED_PRICE: "ราคาพิเศษ",
  BUY_X_GET_Y: "ซื้อ X แถม Y",
  BONUS_MINUTES: "แถมนาทีบริการ",
};

export const LINE_PAYMENT_METHODS = ["CASH", "PACKAGE", "VOUCHER", "COMPLIMENTARY"] as const;
export type LinePaymentMethod = (typeof LINE_PAYMENT_METHODS)[number];

export const LINE_PAYMENT_METHOD_LABEL: Record<LinePaymentMethod, string> = {
  CASH: "เงินสด/บัตร",
  PACKAGE: "ตัดคอร์ส",
  VOUCHER: "วอยเชอร์",
  COMPLIMENTARY: "อภินันทนาการ",
};

// เงื่อนไขการใช้โปรโมชั่น — ตรงกับ PromotionConditions ใน packages/core/promotion/types.ts (T5.3) ทุกฟิลด์
// ไม่บังคับ ไม่ระบุ = ไม่จำกัดเงื่อนไขนั้น ไม่มี branchIds เพราะ Promotion ผูกกับสาขาเดียวอยู่แล้วโดยตัวมันเอง
// (ดู docs/decisions.md ADR-028)
const promotionConditionsShape = {
  minSpendSatang: moneySatang("ยอดขั้นต่ำ").optional(),
  serviceVariantIds: z.array(z.string()).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startMinuteOfDay: z.number().int().min(0).max(1439).optional(),
  endMinuteOfDay: z.number().int().min(0).max(1439).optional(),
  firstTimeCustomerOnly: z.boolean().optional(),
  birthdayMonthOnly: z.boolean().optional(),
  memberTiers: z.array(z.string()).optional(),
};

const promotionSharedFields = {
  name: z.string().trim().min(1, "กรุณากรอกชื่อโปรโมชั่น"),
  priority: z.coerce.number().int("ลำดับความสำคัญต้องเป็นจำนวนเต็ม").default(0),
  quotaTotal: z.coerce.number().int("โควตาต้องเป็นจำนวนเต็ม").min(1, "โควตาต้องมากกว่า 0").optional(),
  ...promotionConditionsShape,
};

// สร้างโปรโมชั่น (T5.4) — 5 ประเภทมีฟิลด์ส่วนลด/ของแถมต่างกันจริง ใช้ discriminated union เหมือน package.ts
export const createPromotionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PERCENT_OFF"),
    ...promotionSharedFields,
    percentOff: z.coerce.number().int("เปอร์เซ็นต์ต้องเป็นจำนวนเต็ม").min(1).max(100),
  }),
  z.object({
    type: z.literal("AMOUNT_OFF"),
    ...promotionSharedFields,
    amountOffSatang: moneySatang("จำนวนที่ลด").min(1, "ต้องมากกว่า 0"),
  }),
  z.object({
    type: z.literal("FIXED_PRICE"),
    ...promotionSharedFields,
    fixedPriceSatang: moneySatang("ราคาพิเศษ"),
  }),
  z.object({
    type: z.literal("BUY_X_GET_Y"),
    ...promotionSharedFields,
    buyQuantity: z.coerce.number().int("จำนวนที่ต้องซื้อต้องเป็นจำนวนเต็ม").min(1),
    getQuantity: z.coerce.number().int("จำนวนที่แถมต้องเป็นจำนวนเต็ม").min(1),
  }),
  z.object({
    type: z.literal("BONUS_MINUTES"),
    ...promotionSharedFields,
    bonusMinutes: z.coerce.number().int("จำนวนนาทีต้องเป็นจำนวนเต็ม").min(1),
  }),
]);
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type CreatePromotionFormInput = z.input<typeof createPromotionSchema>;

// แก้ไขโปรโมชั่น — แก้ไม่ได้แค่ type และฟิลด์ส่วนลด/ของแถมเฉพาะประเภท (เปลี่ยนความหมายพื้นฐานหลังสร้างแล้ว
// ไม่ได้ เหมือนหลักการเดียวกับ updatePackageSchema — ดู docs/decisions.md ADR-028) แก้ได้แค่ชื่อ/ลำดับ/
// โควตา/เงื่อนไข/สถานะเปิดใช้
export const updatePromotionSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อโปรโมชั่น").optional(),
  priority: z.coerce.number().int("ลำดับความสำคัญต้องเป็นจำนวนเต็ม").optional(),
  quotaTotal: z.coerce.number().int("โควตาต้องเป็นจำนวนเต็ม").min(1, "โควตาต้องมากกว่า 0").nullable().optional(),
  isActive: z.boolean().optional(),
  ...promotionConditionsShape,
});
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type UpdatePromotionFormInput = z.input<typeof updatePromotionSchema>;

// ── ฟอร์มฝั่งเว็บ (หน่วยบาท) ──────────────────────────────────────────────────────────────
// พนักงานคุ้นเคยกับการกรอกราคา/ยอดขั้นต่ำเป็น "บาท" ไม่ใช่สตางค์ตรง ๆ — apps/web แปลงเป็นสตางค์เอง
// ก่อนยิงไป createPromotionSchema จริง ตามธรรมเนียมเดียวกับ service.ts/package.ts (ดู CLAUDE.md ข้อ 8)
const promotionConditionsFormShape = {
  minSpendBaht: z.coerce.number().min(0, "ยอดขั้นต่ำต้องไม่ติดลบ").optional(),
  serviceVariantIds: z.array(z.string()).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startMinuteOfDay: z.number().int().min(0).max(1439).optional(),
  endMinuteOfDay: z.number().int().min(0).max(1439).optional(),
  firstTimeCustomerOnly: z.boolean().optional(),
  birthdayMonthOnly: z.boolean().optional(),
  memberTiers: z.array(z.string()).optional(),
};

const promotionSharedFormFields = {
  name: z.string().trim().min(1, "กรุณากรอกชื่อโปรโมชั่น"),
  priority: z.coerce.number().int("ลำดับความสำคัญต้องเป็นจำนวนเต็ม").default(0),
  quotaTotal: z.coerce.number().int("โควตาต้องเป็นจำนวนเต็ม").min(1, "โควตาต้องมากกว่า 0").optional(),
  ...promotionConditionsFormShape,
};

export const promotionFormSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PERCENT_OFF"),
    ...promotionSharedFormFields,
    percentOff: z.coerce.number().int("เปอร์เซ็นต์ต้องเป็นจำนวนเต็ม").min(1).max(100),
  }),
  z.object({
    type: z.literal("AMOUNT_OFF"),
    ...promotionSharedFormFields,
    amountOffBaht: z.coerce.number().min(1, "ต้องมากกว่า 0"),
  }),
  z.object({
    type: z.literal("FIXED_PRICE"),
    ...promotionSharedFormFields,
    fixedPriceBaht: z.coerce.number().min(0, "ราคาพิเศษต้องไม่ติดลบ"),
  }),
  z.object({
    type: z.literal("BUY_X_GET_Y"),
    ...promotionSharedFormFields,
    buyQuantity: z.coerce.number().int("จำนวนที่ต้องซื้อต้องเป็นจำนวนเต็ม").min(1),
    getQuantity: z.coerce.number().int("จำนวนที่แถมต้องเป็นจำนวนเต็ม").min(1),
  }),
  z.object({
    type: z.literal("BONUS_MINUTES"),
    ...promotionSharedFormFields,
    bonusMinutes: z.coerce.number().int("จำนวนนาทีต้องเป็นจำนวนเต็ม").min(1),
  }),
]);
export type PromotionFormInput = z.infer<typeof promotionFormSchema>;
export type PromotionFormFormInput = z.input<typeof promotionFormSchema>;

// คูปอง (T5.4) — ผูกกับโปรโมชั่นหนึ่งใบเสมอ ยังไม่มี logic การแลกใช้จริงใน Task นี้ (แค่ catalog CRUD)
export const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "กรุณากรอกรหัสคูปอง")
    .max(50, "รหัสคูปองยาวเกินไป")
    .transform((v) => v.toUpperCase()),
  maxRedemptions: z.coerce.number().int("จำนวนครั้งต้องเป็นจำนวนเต็ม").min(1, "ต้องมากกว่า 0").optional(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type CreateCouponFormInput = z.input<typeof createCouponSchema>;

export const updateCouponSchema = z.object({
  isActive: z.boolean().optional(),
  maxRedemptions: z.coerce.number().int("จำนวนครั้งต้องเป็นจำนวนเต็ม").min(1, "ต้องมากกว่า 0").nullable().optional(),
});
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

// หน้าทดลองคำนวณ (T5.4) — ใส่ตะกร้าจำลองแล้วดูว่าโปรฯ ไหนจับ ลดเท่าไร เพราะอะไร (จำลองล้วน ไม่บันทึกอะไรลง DB)
// ข้อมูลสมาชิก (tier/ครั้งแรก/เดือนเกิด) รับเป็น input ตรง ๆ ไม่ได้ผูกกับสมาชิกจริง เพราะ Member schema ยังไม่มี
// คอลัมน์ tier/birthDate จริง (ดู docs/decisions.md ADR-027 ข้อควรระวัง)
const calculatorCartLineSchema = z.object({
  serviceVariantId: z.string().min(1, "กรุณาเลือกบริการ"),
  priceSatang: moneySatang("ราคา"),
  paymentMethod: z.enum(LINE_PAYMENT_METHODS),
  quantity: z.coerce.number().int("จำนวนต้องเป็นจำนวนเต็ม").min(1).default(1),
});
export type CalculatorCartLine = z.infer<typeof calculatorCartLineSchema>;

export const calculatePromotionsSchema = z.object({
  couponCode: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .optional(),
  memberTier: z.string().trim().optional(),
  isFirstTimeCustomer: z.boolean().default(false),
  memberBirthMonth: z.coerce.number().int().min(1).max(12).optional(),
  cart: z.array(calculatorCartLineSchema).min(1, "ต้องมีอย่างน้อย 1 รายการในตะกร้าจำลอง"),
});
export type CalculatePromotionsInput = z.infer<typeof calculatePromotionsSchema>;
export type CalculatePromotionsFormInput = z.input<typeof calculatePromotionsSchema>;

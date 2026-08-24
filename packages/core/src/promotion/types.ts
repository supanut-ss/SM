// ชนิดข้อมูลนำเข้า/ผลลัพธ์ของ promotion rule engine (T5.3) — ประกาศเองในนี้ทั้งหมด ไม่ import จาก
// @lotus-desk/contracts หรือที่ไหนอื่น (packages/core ไม่มี dependency ใด ๆ เลย ดู docs/decisions.md ADR-019)

export type PromotionType =
  | "PERCENT_OFF"
  | "AMOUNT_OFF"
  | "FIXED_PRICE"
  | "BUY_X_GET_Y"
  | "BONUS_MINUTES";

/** ช่องทางชำระของแต่ละรายการในตะกร้า — ตรงกับ docs/DOMAIN.md ข้อ 10 (แหล่งชำระของ ServiceJob ใน T5.5) */
export type LinePaymentMethod = "CASH" | "PACKAGE" | "VOUCHER" | "COMPLIMENTARY";

/**
 * เงื่อนไขการใช้โปรโมชั่น — ทุกฟิลด์เป็น optional และ "ไม่ระบุ = ไม่จำกัดเงื่อนไขนั้น" ฟิลด์ tier/เดือนเกิด
 * รับค่าจากผู้เรียกโดยตรง (ยังไม่มีคอลัมน์ tier/birthDate ใน Member schema จริงตอนนี้ — ดู
 * docs/decisions.md ADR-027 ข้อควรระวังสำหรับ Task ในอนาคตที่จะต่อยอด T5.4/T5.6)
 */
export interface PromotionConditions {
  minSpendSatang?: number;
  /** ถ้าระบุ ใช้ได้เฉพาะรายการที่ serviceVariantId ตรงกับลิสต์นี้เท่านั้น */
  serviceVariantIds?: string[];
  /** ถ้าระบุ ใช้ได้เฉพาะสาขาที่ตรงกับลิสต์นี้เท่านั้น */
  branchIds?: string[];
  /** 0 = อาทิตย์ ... 6 = เสาร์ (ตรงกับ Date.getDay() ของ Bangkok wall-clock ที่ผู้เรียกแปลงมาให้แล้ว) */
  daysOfWeek?: number[];
  /** ช่วงเวลาในแต่ละวัน หน่วยนาทีจากเที่ยงคืน (0-1439) — ทั้งคู่ต้องระบุพร้อมกันถ้าจะใช้ */
  startMinuteOfDay?: number;
  endMinuteOfDay?: number;
  firstTimeCustomerOnly?: boolean;
  /** ตรวจกับเดือนเกิดของสมาชิก (1-12) ที่ผู้เรียกส่งมา */
  birthdayMonthOnly?: boolean;
  /** ถ้าระบุ ใช้ได้เฉพาะสมาชิกที่ tier ตรงกับลิสต์นี้เท่านั้น */
  memberTiers?: string[];
}

export interface PromotionRule {
  id: string;
  name: string;
  type: PromotionType;
  /** เทียบตัดสินเมื่อส่วนลดเท่ากันเป๊ะระหว่างหลายโปรฯ — ค่ามากกว่าชนะ (ดู docs/DOMAIN.md ข้อ 15) */
  priority: number;
  /** PERCENT_OFF: 0-100 */
  percentOff?: number;
  /** AMOUNT_OFF: หน่วยสตางค์ */
  amountOffSatang?: number;
  /** FIXED_PRICE: หน่วยสตางค์ — ใช้ได้กับรายการเดียวเท่านั้น (ไม่ใช่ยอดรวมหลายรายการ) */
  fixedPriceSatang?: number;
  /** BUY_X_GET_Y: ซื้อครบ buyQuantity ชิ้น แถม getQuantity ชิ้น (นับจากรายการที่ตรงเงื่อนไขเท่านั้น) */
  buyQuantity?: number;
  getQuantity?: number;
  /** BONUS_MINUTES: จำนวนนาทีที่แถม — ไม่ใช่ส่วนลดเป็นเงิน (discountSatang ของโปรฯ นี้เป็น 0 เสมอ) */
  bonusMinutes?: number;
  conditions: PromotionConditions;
  /** จำนวนครั้งที่เหลือให้ใช้ได้ — null = ไม่จำกัด, 0 = หมดโควตาแล้ว */
  quotaRemaining: number | null;
}

export interface CartLine {
  serviceVariantId: string;
  priceSatang: number;
  paymentMethod: LinePaymentMethod;
  /** จำนวนที่ซื้อของรายการนี้ (สำหรับ BUY_X_GET_Y) ค่าเริ่มต้นคือ 1 ถ้าผู้เรียกไม่ระบุ */
  quantity?: number;
}

export interface EvaluatePromotionsInput {
  /** 0-6 (Sun-Sat) ตาม wall-clock เวลาไทย — ผู้เรียกแปลงมาให้แล้ว (ห้าม derive จาก Date ในนี้เอง เพราะ
   * engine เป็น pure function ห้ามเรียก Date.now()/new Date() เองตาม CLAUDE.md ข้อ 1) */
  dayOfWeek: number;
  /** นาทีจากเที่ยงคืนตามเวลาไทย — ผู้เรียกแปลงมาให้แล้วเช่นกัน */
  minuteOfDay: number;
  /** 1-12 ตามเวลาไทย — ผู้เรียกแปลงมาให้แล้วเช่นกัน (ใช้เช็คเงื่อนไขเดือนเกิด) */
  currentMonth: number;
  branchId: string;
  memberTier: string | null;
  isFirstTimeCustomer: boolean;
  /** 1-12, null ถ้าไม่ทราบวันเกิดสมาชิก */
  memberBirthMonth: number | null;
  cart: CartLine[];
  promotions: PromotionRule[];
}

export interface PromotionApplication {
  promotionId: string;
  promotionName: string;
  discountSatang: number;
  bonusMinutes: number;
  reason: string;
}

export interface RejectedPromotion {
  promotionId: string;
  promotionName: string;
  reason: string;
}

export interface EvaluatePromotionsResult {
  applied: PromotionApplication | null;
  /** โปรฯ ทุกตัวที่พิจารณาแล้วแต่ไม่ถูกเลือก พร้อมเหตุผล — ใช้ในหน้าทดลองคำนวณ (T5.4 เกณฑ์ผ่าน
   * "อธิบายเหตุผลได้ทุกบรรทัด") รวมทั้งกรณีที่ใช้ได้จริงแต่แพ้โปรฯ อื่นที่ลดมากกว่า */
  rejected: RejectedPromotion[];
}

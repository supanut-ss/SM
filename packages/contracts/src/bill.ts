import { z } from "zod";
import { PAYMENT_METHODS } from "./payment.js";

/** เงินทุกฟิลด์เก็บเป็น integer สตางค์เสมอ (ดู CLAUDE.md ข้อ 2) ห้ามใช้ float */
function moneySatang(label: string) {
  return z.coerce
    .number()
    .int(`${label}ต้องเป็นจำนวนเต็ม (หน่วยสตางค์)`)
    .min(0, `${label}ต้องไม่ติดลบ`);
}

export const BILL_STATUSES = ["PAID", "CANCELLED"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];
export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  PAID: "ชำระแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

export const BILL_LINE_KINDS = ["SERVICE_JOB", "PRODUCT"] as const;
export type BillLineKind = (typeof BILL_LINE_KINDS)[number];

// รายการใบงาน (T5.5) ที่จะรวมเข้าบิล — แหล่งชำระอ่านจาก ServiceJob.paymentMethod ที่ตัดสินใจไว้แล้วตอน
// จบงาน (ดู docs/decisions.md ADR-029) ไม่ถามซ้ำตรงนี้ — memberPackageId ต้องระบุเมื่อ paymentMethod
// ของใบงานนั้นเป็น PACKAGE เท่านั้น (สมาชิกอาจมีหลายคอร์ส ต้องเลือกว่าตัดใบไหน)
const checkoutServiceJobLineSchema = z.object({
  serviceJobId: z.string().min(1),
  memberPackageId: z.string().optional(),
});

// รายการสินค้าอิสระ — ไม่ผูกกับ catalog/คลังใด ๆ (ยังไม่มี Product/Inventory model จริง ดู
// docs/decisions.md ADR-030) พนักงานกรอกชื่อ+ราคาเอง
const checkoutProductLineSchema = z.object({
  description: z.string().trim().min(1, "กรุณากรอกชื่อสินค้า"),
  priceSatang: moneySatang("ราคา"),
  quantity: z.coerce.number().int("จำนวนต้องเป็นจำนวนเต็ม").min(1).default(1),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

const checkoutPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amountSatang: moneySatang("จำนวนเงิน"),
  /** เฉพาะ CASH — จำนวนเงินที่ลูกค้ายื่นมาจริง ต้อง >= amountSatang (ส่วนต่างคือเงินทอน) */
  tenderedSatang: moneySatang("จำนวนเงินที่รับมา").optional(),
});

// ออกบิล/เช็คเอาต์ (T5.6) — โปรโมชั่นคำนวณอัตโนมัติฝั่ง server เสมอ (เรียก evaluatePromotions ของ T5.3 จริง
// ตรง ๆ) ไม่รับ promotionId/discountSatang จาก client เด็ดขาด (ห้าม trust ตัวเลขเงินจาก client) ข้อมูล
// สมาชิก (tier/ครั้งแรก/เดือนเกิด) รับเป็น manual input เหมือนหน้าทดลองคำนวณ (ดู ADR-028 ข้อควรระวัง)
export const checkoutBillSchema = z
  .object({
    memberId: z.string().optional(),
    serviceJobLines: z.array(checkoutServiceJobLineSchema).default([]),
    productLines: z.array(checkoutProductLineSchema).default([]),
    payments: z.array(checkoutPaymentSchema).min(1, "ต้องมีอย่างน้อย 1 ช่องทางชำระ"),
    couponCode: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .optional(),
    memberTier: z.string().trim().optional(),
    isFirstTimeCustomer: z.boolean().default(false),
    memberBirthMonth: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((v) => v.serviceJobLines.length + v.productLines.length > 0, {
    message: "ต้องมีอย่างน้อย 1 รายการในบิล",
    path: ["serviceJobLines"],
  });

export type CheckoutBillInput = z.infer<typeof checkoutBillSchema>;

// ยกเลิกบิล (T5.6) — ต้องมี PIN ผู้จัดการเสมอ (ดู docs/DOMAIN.md ข้อ 14) แนบมาเป็น approvalToken
// (จาก POST /auth/verify-manager-pin ดู docs/decisions.md ADR-030) ไม่รับ approvedByUserId เปล่า ๆ อีก
// ต่อไปเหมือนที่ T5.2 (ADR-026) เคยทำไว้ชั่วคราว
export const cancelBillSchema = z.object({
  approvalToken: z.string().min(1, "ต้องมีการอนุมัติจากผู้จัดการก่อนยกเลิกบิล"),
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผลการยกเลิกบิล").max(500),
});

export type CancelBillInput = z.infer<typeof cancelBillSchema>;

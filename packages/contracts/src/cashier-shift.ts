import { z } from "zod";

/** เงินทุกฟิลด์เก็บเป็น integer สตางค์เสมอ (ดู CLAUDE.md ข้อ 2) ห้ามใช้ float */
function moneySatang(label: string) {
  return z.coerce
    .number()
    .int(`${label}ต้องเป็นจำนวนเต็ม (หน่วยสตางค์)`)
    .min(0, `${label}ต้องไม่ติดลบ`);
}

// ปิดรอบกะ (T5.7) — นับเงินสดจริงในลิ้นชัก server คำนวณยอดตามระบบเองเสมอ (ไม่รับ systemCashSatang/
// varianceSatang จาก client) varianceReason บังคับเฉพาะตอนยอดไม่ตรง (เช็คที่ controller เพราะต้องรู้ยอด
// ระบบที่คำนวณสดก่อนถึงจะรู้ว่าต่างกันหรือไม่ ดู docs/decisions.md ADR-031)
export const closeCashierShiftSchema = z.object({
  countedCashSatang: moneySatang("ยอดเงินสดที่นับได้"),
  varianceReason: z.string().trim().max(500).optional(),
});

export type CloseCashierShiftInput = z.infer<typeof closeCashierShiftSchema>;

// เปิดรอบกะใหม่หลังปิดไปแล้ว (T5.7) — ต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) แนบมาเป็น
// approvalToken จาก POST /auth/verify-manager-pin (กลไกเดียวกับยกเลิกบิล T5.6 ดู ADR-030)
export const reopenCashierShiftSchema = z.object({
  approvalToken: z.string().min(1, "ต้องมีการอนุมัติจากผู้จัดการก่อนเปิดรอบกะใหม่"),
});

export type ReopenCashierShiftInput = z.infer<typeof reopenCashierShiftSchema>;

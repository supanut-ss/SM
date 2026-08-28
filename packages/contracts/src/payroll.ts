import { z } from "zod";

// เปิดงวดจ่าย/ปิดงวดจ่าย (T6.4) — ไม่มี request body: เปิดงวดใหม่ใช้เวลาเริ่มงวด (periodStart) เป็น now()
// เสมอ (default ที่ schema), ปิดงวดคำนวณสรุปยอดฝั่ง server ทั้งหมด (composePayrollSummary ของ
// packages/core) ไม่รับตัวเลขใด ๆ จาก client เหมือนกับ CashierShift.open (ดู cashier-shift.ts)

// เปิดงวดจ่ายใหม่หลังปิดไปแล้ว (T6.4) — ต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) แนบมาเป็น
// approvalToken จาก POST /auth/verify-manager-pin (กลไกเดียวกับเปิดรอบกะใหม่ T5.7 และยกเลิกบิล T5.6)
export const reopenPayrollPeriodSchema = z.object({
  approvalToken: z.string().min(1, "ต้องมีการอนุมัติจากผู้จัดการก่อนเปิดงวดจ่ายใหม่"),
});

export type ReopenPayrollPeriodInput = z.infer<typeof reopenPayrollPeriodSchema>;

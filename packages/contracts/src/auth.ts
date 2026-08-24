import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const pinLoginSchema = z.object({
  deviceId: z.string().min(1, "ไม่พบอุปกรณ์"),
  userId: z.string().min(1, "ต้องเลือกพนักงาน"),
  pin: z.string().regex(/^\d{6}$/, "PIN ต้องเป็นตัวเลข 6 หลัก"),
});

export type PinLoginInput = z.infer<typeof pinLoginSchema>;

// ยืนยัน PIN ผู้จัดการแบบ one-off (T5.6) — คืน approvalToken อายุสั้นมาก ไม่ใช่ login เต็มรูป
// ใช้แนบไปกับ endpoint ที่ต้องมี PIN ผู้จัดการก่อนทำ (เช่น ยกเลิกบิล) ดู docs/decisions.md ADR-030
export const verifyManagerPinSchema = z.object({
  branchId: z.string().min(1, "ต้องระบุสาขา"),
  userId: z.string().min(1, "ต้องเลือกผู้จัดการที่จะอนุมัติ"),
  pin: z.string().regex(/^\d{6}$/, "PIN ต้องเป็นตัวเลข 6 หลัก"),
});

export type VerifyManagerPinInput = z.infer<typeof verifyManagerPinSchema>;

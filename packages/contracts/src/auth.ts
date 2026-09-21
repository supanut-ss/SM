import { z } from "zod";

// field ชื่อ "email" คงไว้ตามเดิมแม้จะรับชื่อผู้ใช้ได้ด้วยแล้ว (ดู docs/decisions.md ADR-065) — เปลี่ยนชื่อ
// field เป็น "identifier" จะกระทบ e2e spec ~30 ไฟล์ที่ยิง POST /auth/login ตรง ๆ โดยไม่จำเป็น เลือกรับทั้ง
// อีเมลและชื่อผู้ใช้ในช่องเดิมแทน (backend ลองหาด้วย email ก่อน ถ้าไม่เจอค่อยลองด้วย name)
export const loginSchema = z.object({
  email: z.string().min(1, "กรุณากรอกอีเมลหรือชื่อผู้ใช้"),
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

// เจ้าของร้านตั้งรหัสผ่านใหม่ให้ user คนอื่นโดยตรง (ไม่ผ่าน flow ลืมรหัสผ่าน/อีเมล — ยังไม่มีระบบส่งอีเมล
// reset ในโปรเจกต์นี้) เกทด้วย settings:manage ที่ owner มีสิทธิ์เดียว (ดู permissions.ts) ดู
// docs/decisions.md ADR-059
export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
});

export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

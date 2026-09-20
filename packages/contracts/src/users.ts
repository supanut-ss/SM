import { z } from "zod";
import { ROLE_DEFINITIONS } from "./permissions.js";

// key ของ role ที่มีอยู่จริงในระบบ (4 ตัวคงที่ ดู permissions.ts ROLE_DEFINITIONS) — ใช้ z.enum ตรง ๆ
// กันพิมพ์ผิด/ส่ง key ที่ไม่มีจริงมาได้ตั้งแต่ระดับ validation
const ROLE_KEYS = ROLE_DEFINITIONS.map((r) => r.key) as [string, ...string[]];

// สร้าง user ใหม่ให้สังกัดสาขาปัจจุบันทันที (T-ADR-060) — เกทด้วย settings:manage (owner เท่านั้น
// เหมือน resetUserPasswordSchema) ดู docs/decisions.md ADR-060
export const createUserSchema = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
  roleKey: z.enum(ROLE_KEYS, { message: "บทบาทไม่ถูกต้อง" }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// แก้ชื่อ/อีเมล/บทบาท/สถานะเปิด-ปิดใช้งาน — ไม่มีฟิลด์รหัสผ่านตรงนี้ (แยกไปที่
// resetUserPasswordSchema/endpoint /password โดยเฉพาะ ไม่ปนกันเพื่อไม่ให้แก้ข้อมูลทั่วไปพลาดรีเซ็ต
// รหัสผ่านไปด้วยโดยไม่ตั้งใจ) "ลบ" user ในระบบนี้คือปิดใช้งาน (isActive: false) ไม่ใช่ลบแถวจริง — ตรงกับ
// pattern เดิมของ staff/room/service ทั้งระบบ (soft delete กันประวัติ/บิล/ใบงานเก่าอ้างอิง user ที่หายไปแล้ว)
export const updateUserSchema = z
  .object({
    email: z.string().email("อีเมลไม่ถูกต้อง").optional(),
    name: z.string().min(1, "กรุณากรอกชื่อ").optional(),
    roleKey: z.enum(ROLE_KEYS, { message: "บทบาทไม่ถูกต้อง" }).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่จะแก้ไข" });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

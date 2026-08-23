import { z } from "zod";

/** "" จากฟอร์มเว็บแปลว่า "ไม่กรอก" ไม่ใช่ค่าจริง — แปลงเป็น undefined ก่อนตรวจสอบ schema ด้านหลัง */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

// สมาชิกต้องมีเบอร์เสมอ (ต่างจาก StaffProfile.phone ที่ไม่บังคับ) — ใช้เป็นทั้งช่องทางติดต่อหลักและ
// คีย์เช็คซ้ำตอนสร้าง (ดู docs/decisions.md ADR-014)
export const createMemberSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อสมาชิก"),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{8,9}$/, "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0"),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(1000, "บันทึกยาวเกินไป").optional()),
  // true = ผู้ใช้ยืนยันแล้วว่าต้องการสร้างสมาชิกใหม่ทั้งที่เบอร์ซ้ำกับสมาชิกเดิม (ดู ADR-014 —
  // เตือนแล้วให้ยืนยันสร้างต่อได้ ไม่ใช่ห้ามซ้ำเด็ดขาด)
  confirmDuplicate: z.boolean().optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type CreateMemberFormInput = z.input<typeof createMemberSchema>;

export const updateMemberSchema = createMemberSchema.omit({ confirmDuplicate: true }).partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpdateMemberFormInput = z.input<typeof updateMemberSchema>;

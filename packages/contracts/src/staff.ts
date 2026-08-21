import { z } from "zod";

// ระดับพนักงาน — ผูกกับค่ามือ 3 เรตต่อบริการที่จะเพิ่มบน ServiceVariant ใน T2.3
// (ดู docs/DOMAIN.md ข้อ 9, docs/decisions.md ADR-008) ห้ามเปลี่ยนค่าหลัง seed ขึ้น production
export const STAFF_LEVELS = ["JUNIOR", "SENIOR", "MASTER"] as const;
export type StaffLevel = (typeof STAFF_LEVELS)[number];
export const STAFF_LEVEL_LABEL: Record<StaffLevel, string> = {
  JUNIOR: "จูเนียร์",
  SENIOR: "ซีเนียร์",
  MASTER: "มาสเตอร์",
};

// ทักษะพนักงาน — รายการคงที่ตาม docs/PLAN.md T2.1 เพิ่มค่าใหม่ได้ในอนาคตถ้าร้านต้องการ
export const STAFF_SKILLS = ["THAI_MASSAGE", "OIL", "FACIAL", "NAIL"] as const;
export type StaffSkill = (typeof STAFF_SKILLS)[number];
export const STAFF_SKILL_LABEL: Record<StaffSkill, string> = {
  THAI_MASSAGE: "นวดไทย",
  OIL: "นวดน้ำมัน",
  FACIAL: "ทำหน้า",
  NAIL: "ทำเล็บ",
};

/** "" จากฟอร์มเว็บแปลว่า "ไม่กรอก" ไม่ใช่ค่าจริง — แปลงเป็น undefined ก่อนตรวจสอบ schema ด้านหลัง */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อพนักงาน"),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^0\d{8,9}$/, "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0")
      .optional(),
  ),
  level: z.enum(STAFF_LEVELS, "กรุณาเลือกระดับพนักงาน"),
  skills: z.array(z.enum(STAFF_SKILLS)).min(1, "เลือกทักษะอย่างน้อย 1 อย่าง"),
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(1000, "บันทึกยาวเกินไป").optional()),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
/** shape ก่อนผ่าน resolver (input ของ preprocess เป็น unknown เสมอ) — ใช้ type ฟอร์มฝั่ง React Hook Form */
export type CreateStaffFormInput = z.input<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

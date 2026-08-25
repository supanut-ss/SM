import { z } from "zod";
import { STAFF_SKILLS } from "./staff.js";

/** "" จากฟอร์มเว็บแปลว่า "ไม่กรอก" ไม่ใช่ค่าจริง — แปลงเป็น undefined ก่อนตรวจสอบ schema ด้านหลัง */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** เงินทุกฟิลด์เก็บเป็น integer สตางค์เสมอ (ดู CLAUDE.md ข้อ 2) ห้ามใช้ float */
function moneySatang(label: string) {
  return z.coerce
    .number()
    .int(`${label}ต้องเป็นจำนวนเต็ม (หน่วยสตางค์)`)
    .min(0, `${label}ต้องไม่ติดลบ`);
}

// ตัวเลือกเวลาของบริการ — field ตรงกับ ServiceVariant ใน schema (durationMin, priceSatang,
// ค่ามือ 3 เรตตาม docs/DOMAIN.md ข้อ 9/ADR-008, buffer, ทักษะ/ประเภทห้องที่ต้องใช้)
export const createServiceVariantSchema = z.object({
  durationMin: z.coerce
    .number()
    .int("ระยะเวลาต้องเป็นจำนวนเต็ม (นาที)")
    .min(1, "ระยะเวลาต้องมากกว่า 0"),
  priceSatang: moneySatang("ราคา"),
  commissionJuniorSatang: moneySatang("ค่ามือระดับจูเนียร์"),
  commissionSeniorSatang: moneySatang("ค่ามือระดับซีเนียร์"),
  commissionMasterSatang: moneySatang("ค่ามือระดับมาสเตอร์"),
  bufferBeforeMin: z.coerce
    .number()
    .int("buffer ก่อนบริการต้องเป็นจำนวนเต็ม")
    .min(0, "buffer ก่อนบริการต้องไม่ติดลบ")
    .default(0),
  bufferAfterMin: z.coerce
    .number()
    .int("buffer หลังบริการต้องเป็นจำนวนเต็ม")
    .min(0, "buffer หลังบริการต้องไม่ติดลบ")
    .default(0),
  requiredSkill: z.enum(STAFF_SKILLS, "กรุณาเลือกทักษะที่ต้องใช้"),
  requiredRoomTypeId: z.string().min(1, "กรุณาเลือกประเภทห้องที่ต้องใช้"),
});

export type CreateServiceVariantInput = z.infer<typeof createServiceVariantSchema>;
export type CreateServiceVariantFormInput = z.input<typeof createServiceVariantSchema>;

export const updateServiceVariantSchema = createServiceVariantSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateServiceVariantInput = z.infer<typeof updateServiceVariantSchema>;
export type UpdateServiceVariantFormInput = z.input<typeof updateServiceVariantSchema>;

// บริการ — ต้องมีตัวเลือกเวลาอย่างน้อย 1 แบบตอนสร้าง (เกณฑ์ผ่าน T2.3: สร้างบริการที่มี 3 ตัวเลือกเวลาได้)
export const createServiceSchema = z.object({
  categoryId: z.string().min(1, "กรุณาเลือกหมวดบริการ"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริการ"),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, "คำอธิบายยาวเกินไป").optional(),
  ),
  variants: z.array(createServiceVariantSchema).min(1, "ต้องมีตัวเลือกเวลาอย่างน้อย 1 แบบ"),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateServiceFormInput = z.input<typeof createServiceSchema>;

// แก้ไขข้อมูลบริการระดับบน (ไม่รวมตัวเลือกเวลา — แก้ผ่าน updateServiceVariantSchema แยกต่างหาก)
export const updateServiceSchema = z.object({
  categoryId: z.string().min(1, "กรุณาเลือกหมวดบริการ").optional(),
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริการ").optional(),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, "คำอธิบายยาวเกินไป").optional(),
  ),
  isActive: z.boolean().optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type UpdateServiceFormInput = z.input<typeof updateServiceSchema>;

// ── ฟอร์มฝั่งเว็บ (หน่วยบาท) ──────────────────────────────────────────────────────────────
// พนักงานคุ้นเคยกับการกรอกราคา/ค่ามือเป็น "บาท" ไม่ใช่สตางค์ตรง ๆ — apps/web แปลงเป็นสตางค์เอง
// ก่อนยิงไป createServiceVariantSchema/createServiceSchema (wire schema จริงที่ apps/api validate
// ด้านบน) เสมอ ไม่ใช่ wire schema แต่ authoring อยู่ที่นี่ตามธรรมเนียมเดียวกับ schema อื่นทั้งหมด
// (schema/zod อยู่ที่ packages/contracts เท่านั้น ดู CLAUDE.md ข้อ 8 — apps/web ไม่ import "zod" ตรง ๆ)
export const variantFormSchema = z.object({
  durationMin: z.coerce
    .number()
    .int("ระยะเวลาต้องเป็นจำนวนเต็ม (นาที)")
    .min(1, "ระยะเวลาต้องมากกว่า 0"),
  priceBaht: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
  commissionJuniorBaht: z.coerce.number().min(0, "ค่ามือต้องไม่ติดลบ"),
  commissionSeniorBaht: z.coerce.number().min(0, "ค่ามือต้องไม่ติดลบ"),
  commissionMasterBaht: z.coerce.number().min(0, "ค่ามือต้องไม่ติดลบ"),
  bufferBeforeMin: z.coerce
    .number()
    .int("buffer ก่อนบริการต้องเป็นจำนวนเต็ม")
    .min(0, "buffer ก่อนบริการต้องไม่ติดลบ")
    .default(0),
  bufferAfterMin: z.coerce
    .number()
    .int("buffer หลังบริการต้องเป็นจำนวนเต็ม")
    .min(0, "buffer หลังบริการต้องไม่ติดลบ")
    .default(0),
  requiredSkill: z.enum(STAFF_SKILLS, "กรุณาเลือกทักษะที่ต้องใช้"),
  requiredRoomTypeId: z.string().min(1, "กรุณาเลือกประเภทห้องที่ต้องใช้"),
});

export type VariantFormInput = z.infer<typeof variantFormSchema>;
export type VariantFormFormInput = z.input<typeof variantFormSchema>;

export const serviceFormSchema = z.object({
  categoryId: z.string().min(1, "กรุณาเลือกหมวดบริการ"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริการ"),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, "คำอธิบายยาวเกินไป").optional(),
  ),
  variants: z.array(variantFormSchema).min(1, "ต้องมีตัวเลือกเวลาอย่างน้อย 1 แบบ"),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;
export type ServiceFormFormInput = z.input<typeof serviceFormSchema>;

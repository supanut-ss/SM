import { z } from "zod";

/** เงินทุกฟิลด์เก็บเป็น integer สตางค์เสมอ (ดู CLAUDE.md ข้อ 2) ห้ามใช้ float */
function moneySatang(label: string) {
  return z.coerce
    .number()
    .int(`${label}ต้องเป็นจำนวนเต็ม (หน่วยสตางค์)`)
    .min(0, `${label}ต้องไม่ติดลบ`);
}

// ประเภทคอร์ส/แพ็กเกจ (T5.1) — ตรงกับ enum PackageType ใน packages/db/prisma/schema.prisma
// ดู docs/decisions.md ADR-025 สำหรับเหตุผลที่แต่ละประเภทผูก/ไม่ผูกกับ ServiceVariant เดียว
export const PACKAGE_TYPES = ["SESSION_COUNT", "VALUE", "UNLIMITED_DURATION"] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const PACKAGE_TYPE_LABEL: Record<PackageType, string> = {
  SESSION_COUNT: "แบบจำนวนครั้ง",
  VALUE: "แบบมูลค่า",
  UNLIMITED_DURATION: "แบบไม่จำกัดตามระยะเวลา",
};

const packageNameField = z.string().trim().min(1, "กรุณากรอกชื่อคอร์ส/แพ็กเกจ");
const packageValidDaysField = z.coerce
  .number()
  .int("จำนวนวันหมดอายุต้องเป็นจำนวนเต็ม")
  .min(1, "ต้องมีอายุอย่างน้อย 1 วัน");

// สร้างคอร์ส/แพ็กเกจ (T5.1) — 3 รูปแบบข้อมูลต่างกันจริงต่อประเภท ใช้ discriminated union แทนฟิลด์ optional
// รวมกันหมด เพื่อให้ผิดประเภทแล้ว TypeScript/Zod จับได้ทันที (เช่น ใส่ sessionCount ให้ประเภท VALUE)
export const createPackageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SESSION_COUNT"),
    name: packageNameField,
    priceSatang: moneySatang("ราคา"),
    validDays: packageValidDaysField,
    serviceVariantId: z.string().min(1, "กรุณาเลือกบริการ"),
    sessionCount: z.coerce
      .number()
      .int("จำนวนครั้งต้องเป็นจำนวนเต็ม")
      .min(1, "ต้องมีอย่างน้อย 1 ครั้ง"),
  }),
  z.object({
    type: z.literal("VALUE"),
    name: packageNameField,
    priceSatang: moneySatang("ราคา"),
    validDays: packageValidDaysField,
    valueSatang: moneySatang("มูลค่าคอร์ส").min(1, "มูลค่าคอร์สต้องมากกว่า 0"),
  }),
  z.object({
    type: z.literal("UNLIMITED_DURATION"),
    name: packageNameField,
    priceSatang: moneySatang("ราคา"),
    validDays: packageValidDaysField,
    serviceVariantId: z.string().min(1, "กรุณาเลือกบริการ"),
  }),
]);

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type CreatePackageFormInput = z.input<typeof createPackageSchema>;

// แก้ไขคอร์ส/แพ็กเกจ — แก้ได้แค่ name/priceSatang/validDays/isActive เท่านั้น ห้ามแก้ type/sessionCount/
// valueSatang/serviceVariantId หลังสร้างแล้ว (ดู docs/decisions.md ADR-025 — อาจมีคนซื้อไปแล้ว เปลี่ยน
// ความหมายพื้นฐานย้อนหลังไม่ได้)
export const updatePackageSchema = z.object({
  name: packageNameField.optional(),
  priceSatang: moneySatang("ราคา").optional(),
  validDays: packageValidDaysField.optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

// ── ฟอร์มฝั่งเว็บ (หน่วยบาท) ──────────────────────────────────────────────────────────────
// พนักงานคุ้นเคยกับการกรอกราคา/มูลค่าคอร์สเป็น "บาท" ไม่ใช่สตางค์ตรง ๆ — apps/web แปลงเป็นสตางค์เอง
// ก่อนยิงไป createPackageSchema (wire schema จริงที่ apps/api validate) เสมอ ตามธรรมเนียมเดียวกับ
// service.ts (variantFormSchema/serviceFormSchema) — schema/zod อยู่ที่ packages/contracts เท่านั้น
// (ดู CLAUDE.md ข้อ 8 — apps/web ไม่ import "zod" ตรง ๆ)
const packagePriceBahtField = z.coerce.number().min(0, "ราคาต้องไม่ติดลบ");

export const packageFormSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SESSION_COUNT"),
    name: packageNameField,
    priceBaht: packagePriceBahtField,
    validDays: packageValidDaysField,
    serviceVariantId: z.string().min(1, "กรุณาเลือกบริการ"),
    sessionCount: z.coerce
      .number()
      .int("จำนวนครั้งต้องเป็นจำนวนเต็ม")
      .min(1, "ต้องมีอย่างน้อย 1 ครั้ง"),
  }),
  z.object({
    type: z.literal("VALUE"),
    name: packageNameField,
    priceBaht: packagePriceBahtField,
    validDays: packageValidDaysField,
    valueBaht: z.coerce.number().min(0.01, "มูลค่าคอร์สต้องมากกว่า 0"),
  }),
  z.object({
    type: z.literal("UNLIMITED_DURATION"),
    name: packageNameField,
    priceBaht: packagePriceBahtField,
    validDays: packageValidDaysField,
    serviceVariantId: z.string().min(1, "กรุณาเลือกบริการ"),
  }),
]);

export type PackageFormInput = z.infer<typeof packageFormSchema>;
export type PackageFormFormInput = z.input<typeof packageFormSchema>;

// แก้ไขคอร์ส/แพ็กเกจฝั่งเว็บ (หน่วยบาท) — เฉพาะฟิลด์ที่แก้ได้จริง ดู updatePackageSchema ด้านบน
export const packageEditFormSchema = z.object({
  name: packageNameField,
  priceBaht: packagePriceBahtField,
  validDays: packageValidDaysField,
});

export type PackageEditFormInput = z.infer<typeof packageEditFormSchema>;
export type PackageEditFormFormInput = z.input<typeof packageEditFormSchema>;

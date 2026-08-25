import { z } from "zod";

/** "" จากฟอร์มเว็บแปลว่า "ไม่กรอก" ไม่ใช่ค่าจริง — แปลงเป็น undefined ก่อนตรวจสอบ schema ด้านหลัง */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

// ประเภทการลา — ตกลงให้แยกประเภทชัดเจน (ไม่ใช้ประเภทเดียวรวมกับหมายเหตุอิสระ) ดู docs/decisions.md
export const LEAVE_TYPES = ["SICK", "PERSONAL", "VACATION"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  VACATION: "ลาพักร้อน",
};

// แม่แบบกะ — เวลาเก็บเป็น "นาทีจากเที่ยงคืน" (0-1439 เริ่ม / 1-1440 จบ) ไม่ใช่ timestamptz เพราะเป็น
// เวลาตามผนังที่วนซ้ำทุกสัปดาห์ (ดู docs/decisions.md ADR-012 แนวเดียวกับ ServiceVariant.durationMin)
// ยังไม่รองรับกะข้ามเที่ยงคืน — endMin ต้องมากกว่า startMin เสมอ (ตัดสินใจแล้วตอนเริ่ม T2.4)
const shiftTemplateFields = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อกะ"),
  startMin: z.coerce
    .number()
    .int("เวลาเริ่มต้องเป็นจำนวนเต็ม (นาที)")
    .min(0, "เวลาเริ่มต้องไม่ติดลบ")
    .max(1439, "เวลาเริ่มต้องอยู่ในวันเดียวกัน"),
  endMin: z.coerce
    .number()
    .int("เวลาสิ้นสุดต้องเป็นจำนวนเต็ม (นาที)")
    .min(1, "เวลาสิ้นสุดต้องมากกว่า 0")
    .max(1440, "เวลาสิ้นสุดต้องอยู่ในวันเดียวกัน"),
});

export const createShiftTemplateSchema = shiftTemplateFields.refine((v) => v.endMin > v.startMin, {
  message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม (ยังไม่รองรับกะข้ามเที่ยงคืน)",
  path: ["endMin"],
});

export type CreateShiftTemplateInput = z.infer<typeof createShiftTemplateSchema>;
export type CreateShiftTemplateFormInput = z.input<typeof createShiftTemplateSchema>;

export const updateShiftTemplateSchema = shiftTemplateFields.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateShiftTemplateInput = z.infer<typeof updateShiftTemplateSchema>;
export type UpdateShiftTemplateFormInput = z.input<typeof updateShiftTemplateSchema>;

// จ่ายกะจริง 1 คน ต่อ 1 วัน — เลือกแม่แบบกะ + วันที่ (เวลาจริง snapshot จาก template ฝั่ง API เอง
// ดู docs/decisions.md ADR-012 — ไม่รับ startMin/endMin ตรงจาก client)
export const createStaffShiftSchema = z.object({
  staffId: z.string().min(1, "กรุณาเลือกพนักงาน"),
  shiftTemplateId: z.string().min(1, "กรุณาเลือกกะ"),
  date: z.coerce.date(),
});

export type CreateStaffShiftInput = z.infer<typeof createStaffShiftSchema>;
export type CreateStaffShiftFormInput = z.input<typeof createStaffShiftSchema>;

// วันลา — สร้างเป็นช่วงวันที่ได้ (API ขยายเป็น 1 แถวต่อวันเอง) 1 คนลาได้แค่ประเภทเดียวต่อวัน
export const createStaffLeaveSchema = z
  .object({
    staffId: z.string().min(1, "กรุณาเลือกพนักงาน"),
    type: z.enum(LEAVE_TYPES, "กรุณาเลือกประเภทการลา"),
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(500, "หมายเหตุยาวเกินไป").optional()),
  })
  .refine((v) => v.dateTo >= v.dateFrom, {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา",
    path: ["dateTo"],
  });

export type CreateStaffLeaveInput = z.infer<typeof createStaffLeaveSchema>;
export type CreateStaffLeaveFormInput = z.input<typeof createStaffLeaveSchema>;

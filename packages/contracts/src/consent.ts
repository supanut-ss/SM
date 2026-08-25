import { z } from "zod";

// ประเภทความยินยอม PDPA (T3.3) — ตรงกับ enum ConsentType ใน schema.prisma ห้ามเปลี่ยนชื่อ value
// หลัง seed ขึ้น production (มีผลย้อนหลังกับประวัติความยินยอมที่บันทึกไว้แล้ว)
export const CONSENT_TYPES = ["HEALTH_DATA", "MARKETING"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_TYPE_LABEL: Record<ConsentType, string> = {
  HEALTH_DATA: "เก็บข้อมูลสุขภาพ",
  MARKETING: "รับข่าวสาร/โปรโมชั่น",
};

export const CONSENT_STATUSES = ["GRANTED", "WITHDRAWN"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];
export const CONSENT_STATUS_LABEL: Record<ConsentStatus, string> = {
  GRANTED: "ยินยอม",
  WITHDRAWN: "ถอนความยินยอม",
};

// ช่องทางที่ให้/ถอนความยินยอม — เก็บใน DB เป็น string ธรรมดา (ไม่ใช่ DB enum) เพราะเป็นข้อมูลบรรยาย
// ไม่มี business logic แยกตามค่านี้ (ต่างจาก type/status ที่ผลลัพธ์ต่างกันจริง) รายการนี้แค่จำกัดตัวเลือก
// ในฟอร์มให้เลือกง่าย เพิ่มค่าใหม่ได้ในอนาคตโดยไม่ต้อง migrate schema
export const CONSENT_CHANNELS = ["IN_PERSON", "PHONE", "LINE", "WEBSITE"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
export const CONSENT_CHANNEL_LABEL: Record<ConsentChannel, string> = {
  IN_PERSON: "หน้าร้าน",
  PHONE: "โทรศัพท์",
  LINE: "LINE",
  WEBSITE: "เว็บไซต์",
};

// บันทึกความยินยอม — append-only เสมอ (ดู docs/decisions.md ADR-016) ทุกคำขอคือแถวประวัติใหม่ 1 แถว
export const createMemberConsentSchema = z.object({
  type: z.enum(CONSENT_TYPES, "กรุณาเลือกประเภทความยินยอม"),
  status: z.enum(CONSENT_STATUSES, "กรุณาเลือกสถานะ"),
  channel: z.enum(CONSENT_CHANNELS, "กรุณาเลือกช่องทาง"),
  textVersion: z.string().trim().min(1, "กรุณากรอกเวอร์ชันข้อความยินยอม"),
});

export type CreateMemberConsentInput = z.infer<typeof createMemberConsentSchema>;
export type CreateMemberConsentFormInput = z.input<typeof createMemberConsentSchema>;

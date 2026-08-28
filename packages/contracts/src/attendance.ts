import { z } from "zod";

// ลงเวลาเข้า-ออกงาน (T6.1) — schema สำหรับเครื่องหน้าร้านเท่านั้น (ไม่มีฟอร์มเว็บ จึงไม่ต้องมี
// z.input variant แบบ staff.ts/shift.ts) PIN ยืนยันตัวตนแยกจาก User.pinHash เสมอ (ดู StaffProfile.pinHash)

export const setStaffPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "PIN ต้องเป็นตัวเลข 6 หลัก"),
});

export type SetStaffPinInput = z.infer<typeof setStaffPinSchema>;

// pin เป็น optional (T6.1 ปรับ workflow) — ร้านนี้แคชเชียร์/เจ้าของเป็นคนลงเวลาแทนพนักงานเสมอ ไม่ใช่
// พนักงานเองมากรอก PIN ที่เครื่อง จึงไม่บังคับส่ง pin มา แต่ถ้าส่งมาก็ยังต้องเป็นเลข 6 หลักเหมือนเดิม
// (เผื่อ use case self-service ในอนาคต) ดู AttendanceController.clockIn/clockOut สำหรับ logic ข้ามการตรวจ PIN
export const clockActionSchema = z.object({
  staffId: z.string().min(1, "กรุณาเลือกพนักงาน"),
  pin: z.string().regex(/^\d{6}$/, "PIN ต้องเป็นตัวเลข 6 หลัก").optional(),
});

export type ClockActionInput = z.infer<typeof clockActionSchema>;

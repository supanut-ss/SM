import { z } from "zod";

// สถานะของ AppointmentItem (T4.3) — ค่า literal ตรงกับ enum AppointmentStatus ใน packages/db/prisma/schema.prisma
// โดยตั้งใจ (คนละ declaration กัน เหมือนแพทเทิร์น StaffLevel/StaffSkill ดู docs/decisions.md ADR-019)
export const APPOINTMENT_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "จองไว้",
  CONFIRMED: "ยืนยันแล้ว",
  CHECKED_IN: "เช็คอินแล้ว",
  IN_SERVICE: "กำลังบริการ",
  COMPLETED: "เสร็จแล้ว",
  NO_SHOW: "ไม่มา",
  CANCELLED: "ยกเลิก",
};

// กติกาการข้ามสถานะ (T4.3) — เส้นทางหลัก BOOKED → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED
// ลัดได้ BOOKED → CHECKED_IN ตรง ๆ (ลูกค้า walk-in ไม่ต้องผ่านขั้นยืนยัน ดู docs/PLAN.md T4.6)
// ยกเลิก/ไม่มา ทำได้เฉพาะ "ก่อนเช็คอิน" เท่านั้น (BOOKED/CONFIRMED) — เช็คอินแล้วถือว่าลูกค้ามาจริงแล้ว
// ไม่มีทางย้อนสถานะกลับ (เช่น COMPLETED → IN_SERVICE) และสถานะปลายทาง (COMPLETED/NO_SHOW/CANCELLED)
// ไปต่อไม่ได้อีกเลย — ดู docs/decisions.md ADR-021
const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  BOOKED: ["CONFIRMED", "CHECKED_IN", "NO_SHOW", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "NO_SHOW", "CANCELLED"],
  CHECKED_IN: ["IN_SERVICE"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

/** pure function — ใช้ทั้งฝั่ง apps/api (validate ก่อน update จริง) และฝั่ง apps/web ในอนาคต (T4.5 ปิดปุ่ม
 * ที่ข้ามสถานะไม่ได้) ดู docs/decisions.md ADR-021 */
export function canTransitionAppointmentStatus(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

/** สถานะที่ไปต่อได้จากสถานะปัจจุบัน — ใช้แสดงตัวเลือกที่กดได้จริงบน UI */
export function nextAppointmentStatuses(from: AppointmentStatus): readonly AppointmentStatus[] {
  return APPOINTMENT_TRANSITIONS[from];
}

export const updateAppointmentItemStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES, "กรุณาเลือกสถานะที่ถูกต้อง"),
});

export type UpdateAppointmentItemStatusInput = z.infer<typeof updateAppointmentItemStatusSchema>;

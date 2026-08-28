import { z } from "zod";
import { PAYMENT_METHODS } from "./payment.js";

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

// เปลี่ยนสถานะนัด (T4.3) — เปลี่ยนเป็น IN_SERVICE ต้องระบุแหล่งชำระเสมอ (ตัดสินใจตอนเริ่มงาน ไม่ใช่ตอนจบงาน
// อีกต่อไป ดู docs/decisions.md ADR-046 ที่พลิกกลับ ADR-029 ข้อ 4 ตามคำสั่งเจ้าของร้าน — ลูกค้าจ่าย/ตัดคอร์ส
// ก่อนรับบริการเสมอในความเป็นจริง) ถ้าแหล่งชำระเป็น PACKAGE ต้องระบุ memberPackageId ที่จะตัดมาด้วยเลย
// (การตัด ledger จริงยังเกิดตอน checkout เหมือนเดิม — ดู bill.controller.ts) COMPLETED ไม่ต้องการ/ไม่รับ
// paymentMethod อีกต่อไป (แค่ปิด completedAt)
export const updateAppointmentItemStatusSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUSES, "กรุณาเลือกสถานะที่ถูกต้อง"),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    memberPackageId: z.string().optional(),
  })
  .refine((v) => v.status !== "IN_SERVICE" || v.paymentMethod !== undefined, {
    message: "กรุณาเลือกแหล่งชำระก่อนเริ่มงาน",
    path: ["paymentMethod"],
  })
  .refine((v) => v.status !== "IN_SERVICE" || v.paymentMethod !== "PACKAGE" || v.memberPackageId !== undefined, {
    message: "กรุณาเลือกคอร์สที่จะตัด",
    path: ["memberPackageId"],
  });

export type UpdateAppointmentItemStatusInput = z.infer<typeof updateAppointmentItemStatusSchema>;

// วิธีที่นัดถูกจ่ายให้พนักงาน (T4.4) — ตรงกับ enum AssignType ใน packages/db/prisma/schema.prisma
// มีผลต่อคิวหมุนตอนจบงาน (ดู docs/DOMAIN.md ข้อ 2, docs/decisions.md ADR-022)
export const ASSIGN_TYPES = ["ROTATION", "CUSTOMER_REQUEST"] as const;
export type AssignType = (typeof ASSIGN_TYPES)[number];

export const ASSIGN_TYPE_LABEL: Record<AssignType, string> = {
  ROTATION: "คิวหมุน",
  CUSTOMER_REQUEST: "ลูกค้าขอ",
};

// เข้าคิวหมุน (T4.4) — date ไม่ระบุ = วันนี้ตามเวลาไทย (ฝั่ง apps/api เป็นคนคำนวณ ไม่ใช่ client)
export const joinStaffQueueSchema = z.object({
  staffId: z.string().min(1, "กรุณาเลือกพนักงาน"),
  date: z.coerce.date().optional(),
});

export type JoinStaffQueueInput = z.infer<typeof joinStaffQueueSchema>;

// ลากวาง/ย่อขยายบล็อกบน Lane Board (T4.5) — เปลี่ยนพนักงาน/ห้อง/เวลาของนัดที่มีอยู่แล้ว
// (คนละ endpoint กับ updateAppointmentItemStatusSchema ของ T4.3 ที่เปลี่ยนแค่สถานะ)
export const rescheduleAppointmentItemSchema = z
  .object({
    staffId: z.string().min(1, "กรุณาเลือกพนักงาน"),
    roomId: z.string().min(1, "กรุณาเลือกห้อง"),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม",
    path: ["endAt"],
  });

export type RescheduleAppointmentItemInput = z.infer<typeof rescheduleAppointmentItemSchema>;

// จองด่วนจากคิวหมุน (T4.6) — ไม่ต้องเลือกพนักงาน/ห้อง/เวลาเอง ระบบเลือกให้จากคิวหมุน+ห้องว่างที่ใกล้ที่สุด
// (ดู apps/api availability engine integration) memberId ไม่ใส่ได้ (ลูกค้า walk-in ที่ยังไม่ได้ลงทะเบียนสมาชิก)
export const createWalkInAppointmentSchema = z.object({
  serviceVariantId: z.string().min(1, "กรุณาเลือกบริการ"),
  memberId: z.string().optional(),
});

export type CreateWalkInAppointmentInput = z.infer<typeof createWalkInAppointmentSchema>;

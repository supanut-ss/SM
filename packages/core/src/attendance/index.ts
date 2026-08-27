// ลงเวลาเข้า-ออกงาน — pure function เท่านั้น (T6.2 ของแผน, ดู docs/PLAN.md §5 T6.1) ไม่แตะ Prisma/Nest/
// Date.now() — ผู้เรียก (apps/api) แปลง instant เป็น "นาทีจากเที่ยงคืนตามผนังเวลาไทย" ก่อนเสมอ (แพทเทิร์น
// เดียวกับ packages/core/promotion ที่รับ dayOfWeek/minuteOfDay เป็นตัวเลขล้วน ไม่รับ Date ตรง ๆ)
//
// docs/DOMAIN.md ข้อ 13: ไม่มีค่าปรับสาย/ขาดงาน ใช้ระบบตักเตือนแทน — ฟังก์ชันนี้จึงแค่ "รายงาน" ตัวเลข
// สาย/ออกก่อน/OT ไม่ตัดสินใจเรื่องเงินใด ๆ ทั้งสิ้น

export type AttendanceStatus = "ON_TIME" | "LATE" | "LEFT_EARLY" | "LATE_AND_LEFT_EARLY" | "ABSENT" | "NO_SHIFT";

export interface EvaluateAttendanceInput {
  /** นาทีจากเที่ยงคืน (ตามผนังเวลาไทย) ที่กะเริ่ม — null ถ้าไม่พบกะที่ตรงกับวันนั้น */
  shiftStartMin: number | null;
  /** นาทีจากเที่ยงคืน (ตามผนังเวลาไทย) ที่กะสิ้นสุด — null ถ้าไม่พบกะที่ตรงกับวันนั้น */
  shiftEndMin: number | null;
  /** นาทีจากเที่ยงคืนที่ลงเวลาเข้า — null ถ้ายังไม่ได้ลงเวลาเข้าเลย */
  clockInMinuteOfDay: number | null;
  /** นาทีจากเที่ยงคืนที่ลงเวลาออก — null ถ้ายังไม่ได้ลงเวลาออก */
  clockOutMinuteOfDay: number | null;
}

export interface AttendanceResult {
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otMinutes: number;
}

const ZERO_RESULT = { lateMinutes: 0, earlyLeaveMinutes: 0, otMinutes: 0 };

/**
 * ประเมินการลงเวลา 1 รายการเทียบกับกะที่ควรทำงาน — ไม่รองรับกะที่ข้ามเที่ยงคืน (ตาม ADR-013 ที่ StaffShift
 * เองก็ไม่รองรับอยู่แล้ว) จึงถือว่า clockIn/clockOutMinuteOfDay อยู่ในวันปฏิทินเดียวกับกะเสมอ
 */
export function evaluateAttendance(input: EvaluateAttendanceInput): AttendanceResult {
  const { shiftStartMin, shiftEndMin, clockInMinuteOfDay, clockOutMinuteOfDay } = input;

  if (shiftStartMin === null || shiftEndMin === null) {
    return { status: "NO_SHIFT", ...ZERO_RESULT };
  }
  if (clockInMinuteOfDay === null) {
    return { status: "ABSENT", ...ZERO_RESULT };
  }

  const lateMinutes = Math.max(0, clockInMinuteOfDay - shiftStartMin);
  const earlyLeaveMinutes = clockOutMinuteOfDay === null ? 0 : Math.max(0, shiftEndMin - clockOutMinuteOfDay);
  const otMinutes = clockOutMinuteOfDay === null ? 0 : Math.max(0, clockOutMinuteOfDay - shiftEndMin);

  let status: AttendanceStatus = "ON_TIME";
  if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = "LATE_AND_LEFT_EARLY";
  else if (lateMinutes > 0) status = "LATE";
  else if (earlyLeaveMinutes > 0) status = "LEFT_EARLY";

  return { status, lateMinutes, earlyLeaveMinutes, otMinutes };
}

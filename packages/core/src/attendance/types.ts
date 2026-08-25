// ชนิดข้อมูลนำเข้า/ผลลัพธ์ของ attendance engine (T6.1) — ประกาศเองในนี้ทั้งหมด ไม่ import จาก
// @lotus-desk/contracts หรือที่ไหนอื่น เหมือนหลักการเดียวกับ packages/core/availability (ดู ADR-019)

/** ช่วงเวลากะของพนักงาน 1 กะ — startMin/endMin เป็นนาทีนับจากเที่ยงคืนตามเวลาไทยของวันนั้น (เหมือน StaffShift) */
export interface ShiftWindow {
  id: string;
  startMin: number;
  endMin: number;
}

export interface MatchShiftForClockInInput {
  /** นาทีนับจากเที่ยงคืนตามเวลาไทยของเวลาที่ลงเวลาเข้างานจริง (ดู minutesSinceBangkokMidnight) */
  localMinutes: number;
  /** กะทั้งหมดของพนักงานคนนี้ในวันเดียวกับที่ลงเวลาเข้างาน */
  shiftsToday: ShiftWindow[];
  /** id ของกะที่มีการลงเวลาเข้างานจับคู่ไปแล้วในวันนี้ (กันจับคู่ซ้ำตอนพนักงานมีหลายกะ) */
  claimedShiftIds: string[];
}

export interface MatchShiftForClockInResult {
  /** กะที่จับคู่ได้ใกล้เคียงที่สุด — null ถ้าไม่มีกะให้จับคู่เลย (ลงเวลานอกตาราง) */
  matchedShift: ShiftWindow | null;
  /** นาทีที่มาสาย เทียบกับ matchedShift.startMin — null ถ้าไม่มีกะให้เทียบ (max(0, ...) เสมอ ไม่ติดลบ) */
  lateMinutes: number | null;
}

export interface ClockOutMetricsInput {
  /** นาทีนับจากเที่ยงคืนตามเวลาไทยของเวลาที่ลงเวลาออกงานจริง */
  localMinutes: number;
  /** กะที่จับคู่ไว้ตอนลงเวลาเข้างาน (จาก AttendanceRecord.staffShiftId) — null ถ้าไม่มีกะให้เทียบ */
  shift: ShiftWindow | null;
}

export interface ClockOutMetricsResult {
  /** นาทีที่ทำงานเกินกะ (ล่วงเวลา) — null ถ้าไม่มีกะให้เทียบ */
  otMinutes: number | null;
  /** นาทีที่ออกก่อนกะจบ — null ถ้าไม่มีกะให้เทียบ */
  earlyLeaveMinutes: number | null;
}

export type ShiftAttendanceStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "ABSENT";

export interface AttendedShift {
  clockInAt: Date;
  clockOutAt: Date | null;
}

export interface SummarizeDailyShiftStatusInput {
  shiftsToday: ShiftWindow[];
  /** ลงเวลาที่จับคู่กับกะแล้วเท่านั้น (staffShiftId ไม่ null) คีย์ตาม shift.id */
  attendanceByShiftId: Record<string, AttendedShift>;
  /**
   * นาทีอ้างอิงสำหรับตัดสิน "ขาด": ถ้าเป็นวันปัจจุบันให้ส่งนาทีปัจจุบัน (เทียบเฉพาะกะที่ endMin ผ่านไปแล้ว
   * ถือว่าขาด กะที่ยังไม่ถึงเวลาเริ่มถือว่า "ยังไม่ถึงเวลา" ไม่ใช่ขาด) ถ้าเป็นวันที่ผ่านไปแล้วให้ส่ง 1440
   * (เที่ยงคืนของวันถัดไป) เพื่อให้ทุกกะที่ไม่มีการลงเวลาถือว่า "ขาด" เสมอเพราะวันนั้นจบไปแล้ว
   */
  nowMinutesOfDay: number;
}

export interface DailyShiftStatus {
  shiftId: string;
  status: ShiftAttendanceStatus;
}

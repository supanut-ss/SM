// ลงเวลาทำงาน (T6.1) — pure function เท่านั้น ห้าม import Prisma/Nest/React/fetch
// เวลาปัจจุบันรับเป็น parameter เสมอ (ห้ามเรียก Date.now() ตรง ๆ) — ดู docs/PLAN.md T6.1 (§5)
// ไม่มีค่าปรับหักเงินจากสาย/ขาด (docs/DOMAIN.md ข้อ 13) — ฟังก์ชันในไฟล์นี้คำนวณตัวเลขไว้ "รายงาน/ตักเตือน"
// เท่านั้น ไม่มีผลต่อค่ามือ (ต่างจาก packages/core/commission ที่ยังห้ามเริ่มจนกว่าจะมีตัวเลขค่ามือจริง)
export type {
  AttendedShift,
  ClockOutMetricsInput,
  ClockOutMetricsResult,
  DailyShiftStatus,
  MatchShiftForClockInInput,
  MatchShiftForClockInResult,
  ShiftAttendanceStatus,
  ShiftWindow,
  SummarizeDailyShiftStatusInput,
} from "./types.js";

import type {
  ClockOutMetricsInput,
  ClockOutMetricsResult,
  DailyShiftStatus,
  MatchShiftForClockInInput,
  MatchShiftForClockInResult,
  SummarizeDailyShiftStatusInput,
} from "./types.js";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;

/**
 * นาทีนับจากเที่ยงคืนตามเวลาไทยของ instant ที่ให้มา — คำนวณบน UTC+7 คงที่ตรง ๆ (ไทยไม่มี DST เลย) เหมือน
 * หลักการเดียวกับ ceilToGrid ใน packages/core/availability ไม่ต้องรู้จัก timezone library ใด ๆ
 */
export function minutesSinceBangkokMidnight(date: Date): number {
  const bangkokMs = date.getTime() + BANGKOK_OFFSET_MS;
  const minutesTotal = Math.floor(bangkokMs / MINUTE_MS);
  return ((minutesTotal % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** วันที่ตามปฏิทินกรุงเทพฯ ของ instant ที่ให้มา รูปแบบ "YYYY-MM-DD" — ใช้จับคู่กับ StaffShift.date */
export function bangkokDateKey(date: Date): string {
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const y = bangkok.getUTCFullYear();
  const m = (bangkok.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = bangkok.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** สองเวลาตกในนาทีเดียวกันหรือไม่ (timezone-invariant — "นาที" เป็นช่วงเดียวกันไม่ว่าเทียบใน timezone ไหน) */
export function isSameMinute(a: Date, b: Date): boolean {
  return Math.floor(a.getTime() / MINUTE_MS) === Math.floor(b.getTime() / MINUTE_MS);
}

/**
 * จับคู่เวลาที่ลงเข้างานกับกะที่ "ยังไม่ถูกจับคู่" ที่ startMin ใกล้เคียงที่สุด (ทั้งมาก่อนและหลัง) — พนักงาน
 * ที่มีกะแบ่งครึ่ง (คร่อมพักเที่ยง) จะได้จับคู่กับกะที่ตั้งใจมาจริง ๆ ไม่ใช่กะแรกที่เจอ ถ้าไม่มีกะเหลือให้
 * จับคู่เลย (ไม่มีกะวันนั้น หรือจับคู่ครบทุกกะแล้ว) คืน matchedShift เป็น null — ถือว่าลงเวลานอกตาราง
 */
export function matchShiftForClockIn(input: MatchShiftForClockInInput): MatchShiftForClockInResult {
  const { localMinutes, shiftsToday, claimedShiftIds } = input;
  const claimed = new Set(claimedShiftIds);
  const candidates = shiftsToday.filter((s) => !claimed.has(s.id));

  if (candidates.length === 0) {
    return { matchedShift: null, lateMinutes: null };
  }

  let best = candidates[0]!;
  let bestDistance = Math.abs(localMinutes - best.startMin);
  for (const candidate of candidates.slice(1)) {
    const distance = Math.abs(localMinutes - candidate.startMin);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return {
    matchedShift: best,
    lateMinutes: Math.max(0, localMinutes - best.startMin),
  };
}

/** คำนวณ OT/ออกก่อนเวลา เทียบกับกะที่จับคู่ไว้ตอนลงเวลาเข้างาน — ไม่มีกะให้เทียบ (null) คืนทั้งคู่เป็น null */
export function computeClockOutMetrics(input: ClockOutMetricsInput): ClockOutMetricsResult {
  const { localMinutes, shift } = input;
  if (!shift) {
    return { otMinutes: null, earlyLeaveMinutes: null };
  }
  return {
    otMinutes: Math.max(0, localMinutes - shift.endMin),
    earlyLeaveMinutes: Math.max(0, shift.endMin - localMinutes),
  };
}

/**
 * สรุปสถานะการลงเวลาของทุกกะในวันนั้น — ใช้ทำรายงาน "สาย/ขาด" (docs/DOMAIN.md ข้อ 13: ไม่มีค่าปรับ แต่ต้อง
 * คำนวณไว้เพื่อรายงาน) ผู้เรียกกำหนด nowMinutesOfDay เอง: ส่งนาทีปัจจุบันจริงถ้าสรุปวันนี้ (กะที่ยังไม่ถึง
 * เวลาเริ่มจะเป็น UPCOMING ไม่ใช่ ABSENT) หรือส่ง 1440 ถ้าสรุปวันที่ผ่านไปแล้ว (ให้ทุกกะที่ไม่มีคนมาถือว่า
 * ขาดเสมอเพราะวันนั้นจบไปแล้ว)
 */
export function summarizeDailyShiftStatus(input: SummarizeDailyShiftStatusInput): DailyShiftStatus[] {
  const { shiftsToday, attendanceByShiftId, nowMinutesOfDay } = input;

  return shiftsToday.map((shift) => {
    const attended = attendanceByShiftId[shift.id];
    if (attended) {
      return {
        shiftId: shift.id,
        status: attended.clockOutAt ? "COMPLETED" : "IN_PROGRESS",
      } as const;
    }
    if (nowMinutesOfDay >= shift.endMin) {
      return { shiftId: shift.id, status: "ABSENT" } as const;
    }
    return { shiftId: shift.id, status: "UPCOMING" } as const;
  });
}

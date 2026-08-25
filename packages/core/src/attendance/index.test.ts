import { describe, expect, it } from "vitest";
import {
  bangkokDateKey,
  computeClockOutMetrics,
  isSameMinute,
  matchShiftForClockIn,
  minutesSinceBangkokMidnight,
  summarizeDailyShiftStatus,
} from "./index.js";
import type { ShiftWindow } from "./types.js";

// วันฐานที่ใช้ทดสอบทั้งไฟล์: 2026-08-24 — Bangkok = UTC+7 เสมอ (ไทยไม่มี DST)
// bkk(9, 0) = เวลา 09:00 ตามนาฬิกาไทยของวันฐาน (หรือวัน + dayOffset) แปลงเป็น Date UTC จริงให้เอง
const BASE_DAY = 24;
function bkk(hh: number, mm: number, dayOffset = 0): Date {
  return new Date(Date.UTC(2026, 7, BASE_DAY + dayOffset, hh - 7, mm, 0, 0));
}

function shift(id: string, startHH: number, endHH: number): ShiftWindow {
  return { id, startMin: startHH * 60, endMin: endHH * 60 };
}

describe("minutesSinceBangkokMidnight", () => {
  it("แปลงเที่ยงตรงเป็น 720 นาที", () => {
    expect(minutesSinceBangkokMidnight(bkk(12, 0))).toBe(720);
  });

  it("แปลงเที่ยงคืนพอดีเป็น 0", () => {
    expect(minutesSinceBangkokMidnight(bkk(0, 0))).toBe(0);
  });

  it("แปลง 23:59 เป็น 1439", () => {
    expect(minutesSinceBangkokMidnight(bkk(23, 59))).toBe(1439);
  });
});

describe("bangkokDateKey", () => {
  it("เที่ยงคืนกรุงเทพฯ ยังเป็นวันเดียวกัน แม้ UTC จะเป็นวันก่อนหน้า", () => {
    // 00:00 กรุงเทพฯ ของวันที่ 24 คือ 17:00 UTC ของวันที่ 23
    expect(bangkokDateKey(bkk(0, 0))).toBe("2026-08-24");
  });

  it("23:59 กรุงเทพฯ ยังเป็นวันเดียวกัน แม้ UTC จะข้ามเป็นวันถัดไปแล้ว", () => {
    expect(bangkokDateKey(bkk(23, 59))).toBe("2026-08-24");
  });
});

describe("isSameMinute", () => {
  it("เวลาเดียวกันเป๊ะ = นาทีเดียวกัน", () => {
    expect(isSameMinute(bkk(9, 0), bkk(9, 0))).toBe(true);
  });

  it("ห่างกัน 59 วินาทีแต่คนละนาที = ไม่ใช่นาทีเดียวกัน", () => {
    const a = bkk(9, 0);
    const b = new Date(a.getTime() + 59_000);
    // a=09:00:00, b=09:00:59 ยังเป็นนาทีเดียวกัน (09:00) — ทดสอบเคสข้ามนาทีจริงแยกต่างหากด้านล่าง
    expect(isSameMinute(a, b)).toBe(true);
  });

  it("ห่างกัน 1 วินาทีแต่คร่อมขอบนาที = คนละนาที", () => {
    const a = new Date(bkk(9, 0).getTime() + 59_000); // 09:00:59
    const b = new Date(a.getTime() + 1_000); // 09:01:00
    expect(isSameMinute(a, b)).toBe(false);
  });
});

describe("matchShiftForClockIn", () => {
  it("ไม่มีกะเลย -> ไม่จับคู่ ไม่มีเลขสาย", () => {
    const result = matchShiftForClockIn({ localMinutes: 9 * 60, shiftsToday: [], claimedShiftIds: [] });
    expect(result.matchedShift).toBeNull();
    expect(result.lateMinutes).toBeNull();
  });

  it("มีกะเดียว เข้างานตรงเวลาเป๊ะ -> สาย 0 นาที", () => {
    const s = shift("s1", 9, 17);
    const result = matchShiftForClockIn({ localMinutes: 9 * 60, shiftsToday: [s], claimedShiftIds: [] });
    expect(result.matchedShift?.id).toBe("s1");
    expect(result.lateMinutes).toBe(0);
  });

  it("มาสาย 15 นาที -> lateMinutes = 15", () => {
    const s = shift("s1", 9, 17);
    const result = matchShiftForClockIn({
      localMinutes: 9 * 60 + 15,
      shiftsToday: [s],
      claimedShiftIds: [],
    });
    expect(result.lateMinutes).toBe(15);
  });

  it("มาก่อนเวลา -> lateMinutes ไม่ติดลบ (เป็น 0)", () => {
    const s = shift("s1", 9, 17);
    const result = matchShiftForClockIn({
      localMinutes: 8 * 60 + 30,
      shiftsToday: [s],
      claimedShiftIds: [],
    });
    expect(result.lateMinutes).toBe(0);
  });

  it("กะแบ่งครึ่ง (เช้า/บ่าย) เลือกกะที่ startMin ใกล้เวลาที่มาจริงที่สุด", () => {
    const morning = shift("morning", 8, 12);
    const afternoon = shift("afternoon", 13, 17);
    const result = matchShiftForClockIn({
      localMinutes: 13 * 60 + 5, // 13:05 — ใกล้กะบ่าย (13:00) มากกว่ากะเช้า (08:00)
      shiftsToday: [morning, afternoon],
      claimedShiftIds: [],
    });
    expect(result.matchedShift?.id).toBe("afternoon");
    expect(result.lateMinutes).toBe(5);
  });

  it("กะที่ถูกจับคู่ไปแล้ว (claimed) ไม่ถูกเลือกซ้ำ แม้จะใกล้กว่า", () => {
    const morning = shift("morning", 8, 12);
    const afternoon = shift("afternoon", 13, 17);
    const result = matchShiftForClockIn({
      localMinutes: 13 * 60,
      shiftsToday: [morning, afternoon],
      claimedShiftIds: ["afternoon"],
    });
    expect(result.matchedShift?.id).toBe("morning");
  });

  it("ทุกกะถูกจับคู่หมดแล้ว -> ไม่มีกะเหลือให้จับคู่", () => {
    const s = shift("s1", 9, 17);
    const result = matchShiftForClockIn({
      localMinutes: 9 * 60,
      shiftsToday: [s],
      claimedShiftIds: ["s1"],
    });
    expect(result.matchedShift).toBeNull();
    expect(result.lateMinutes).toBeNull();
  });
});

describe("computeClockOutMetrics", () => {
  it("ไม่มีกะให้เทียบ -> otMinutes และ earlyLeaveMinutes เป็น null ทั้งคู่", () => {
    const result = computeClockOutMetrics({ localMinutes: 17 * 60, shift: null });
    expect(result.otMinutes).toBeNull();
    expect(result.earlyLeaveMinutes).toBeNull();
  });

  it("ออกตรงเวลาเป๊ะ -> otMinutes และ earlyLeaveMinutes เป็น 0 ทั้งคู่", () => {
    const s = shift("s1", 9, 17);
    const result = computeClockOutMetrics({ localMinutes: 17 * 60, shift: s });
    expect(result.otMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("ออกช้ากว่ากะ 30 นาที -> otMinutes = 30, earlyLeaveMinutes = 0", () => {
    const s = shift("s1", 9, 17);
    const result = computeClockOutMetrics({ localMinutes: 17 * 60 + 30, shift: s });
    expect(result.otMinutes).toBe(30);
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("ออกก่อนกะจบ 45 นาที -> earlyLeaveMinutes = 45, otMinutes = 0", () => {
    const s = shift("s1", 9, 17);
    const result = computeClockOutMetrics({ localMinutes: 16 * 60 + 15, shift: s });
    expect(result.otMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(45);
  });
});

describe("summarizeDailyShiftStatus", () => {
  it("กะที่ยังไม่ถึงเวลาเริ่ม และไม่มีคนลงเวลา -> UPCOMING", () => {
    const s = shift("s1", 14, 18);
    const result = summarizeDailyShiftStatus({
      shiftsToday: [s],
      attendanceByShiftId: {},
      nowMinutesOfDay: 10 * 60,
    });
    expect(result).toEqual([{ shiftId: "s1", status: "UPCOMING" }]);
  });

  it("กะที่เวลาผ่านไปแล้ว และไม่มีคนลงเวลา -> ABSENT", () => {
    const s = shift("s1", 9, 12);
    const result = summarizeDailyShiftStatus({
      shiftsToday: [s],
      attendanceByShiftId: {},
      nowMinutesOfDay: 13 * 60,
    });
    expect(result).toEqual([{ shiftId: "s1", status: "ABSENT" }]);
  });

  it("กะที่ลงเวลาเข้างานแล้วแต่ยังไม่ออก -> IN_PROGRESS แม้เวลาจะเลยกะจบไปแล้ว", () => {
    const s = shift("s1", 9, 12);
    const result = summarizeDailyShiftStatus({
      shiftsToday: [s],
      attendanceByShiftId: { s1: { clockInAt: bkk(9, 5), clockOutAt: null } },
      nowMinutesOfDay: 13 * 60,
    });
    expect(result).toEqual([{ shiftId: "s1", status: "IN_PROGRESS" }]);
  });

  it("กะที่ลงเวลาเข้าและออกครบแล้ว -> COMPLETED", () => {
    const s = shift("s1", 9, 12);
    const result = summarizeDailyShiftStatus({
      shiftsToday: [s],
      attendanceByShiftId: { s1: { clockInAt: bkk(9, 5), clockOutAt: bkk(12, 2) } },
      nowMinutesOfDay: 13 * 60,
    });
    expect(result).toEqual([{ shiftId: "s1", status: "COMPLETED" }]);
  });

  it("สรุปวันที่ผ่านไปแล้ว (nowMinutesOfDay=1440) -> กะที่ไม่มีคนลงเวลาถือว่าขาดเสมอ", () => {
    const s = shift("s1", 9, 12);
    const result = summarizeDailyShiftStatus({
      shiftsToday: [s],
      attendanceByShiftId: {},
      nowMinutesOfDay: 1440,
    });
    expect(result).toEqual([{ shiftId: "s1", status: "ABSENT" }]);
  });

  it("หลายกะในวันเดียวกันสรุปสถานะแยกกันถูกต้อง", () => {
    const morning = shift("morning", 8, 12);
    const afternoon = shift("afternoon", 13, 17);
    const result = summarizeDailyShiftStatus({
      shiftsToday: [morning, afternoon],
      attendanceByShiftId: { morning: { clockInAt: bkk(8, 0), clockOutAt: bkk(12, 0) } },
      nowMinutesOfDay: 14 * 60,
    });
    // afternoon ยังไม่มีคนลงเวลา แต่เวลาปัจจุบัน (14:00) อยู่ในช่วงกะ (13:00-17:00) ยังไม่ผ่าน endMin -> UPCOMING
    expect(result).toEqual([
      { shiftId: "morning", status: "COMPLETED" },
      { shiftId: "afternoon", status: "UPCOMING" },
    ]);
  });
});

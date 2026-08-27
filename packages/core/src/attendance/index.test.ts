import { describe, expect, it } from "vitest";
import { evaluateAttendance, type EvaluateAttendanceInput } from "./index.js";

const SHIFT: Pick<EvaluateAttendanceInput, "shiftStartMin" | "shiftEndMin"> = {
  shiftStartMin: 9 * 60, // 09:00
  shiftEndMin: 18 * 60, // 18:00
};

describe("evaluateAttendance", () => {
  it("ไม่มีกะที่ตรงกับวันนั้น -> NO_SHIFT ไม่ว่าจะลงเวลาหรือไม่", () => {
    const result = evaluateAttendance({
      shiftStartMin: null,
      shiftEndMin: null,
      clockInMinuteOfDay: 9 * 60,
      clockOutMinuteOfDay: 18 * 60,
    });
    expect(result).toEqual({ status: "NO_SHIFT", lateMinutes: 0, earlyLeaveMinutes: 0, otMinutes: 0 });
  });

  it("มีกะแต่ไม่เคยลงเวลาเข้าเลย -> ABSENT", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: null, clockOutMinuteOfDay: null });
    expect(result).toEqual({ status: "ABSENT", lateMinutes: 0, earlyLeaveMinutes: 0, otMinutes: 0 });
  });

  it("เข้าตรงเวลาเป๊ะ ยังไม่ออก -> ON_TIME", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60, clockOutMinuteOfDay: null });
    expect(result.status).toBe("ON_TIME");
    expect(result.lateMinutes).toBe(0);
  });

  it("เข้าก่อนเวลากะ -> ยังถือว่า ON_TIME (ไม่ติดลบ)", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 8 * 60 + 45, clockOutMinuteOfDay: null });
    expect(result.status).toBe("ON_TIME");
    expect(result.lateMinutes).toBe(0);
  });

  it("เข้าสาย 15 นาที -> LATE", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60 + 15, clockOutMinuteOfDay: null });
    expect(result.status).toBe("LATE");
    expect(result.lateMinutes).toBe(15);
  });

  it("ออกตรงเวลาเป๊ะ -> ON_TIME ไม่มี OT ไม่มีออกก่อน", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60, clockOutMinuteOfDay: 18 * 60 });
    expect(result).toEqual({ status: "ON_TIME", lateMinutes: 0, earlyLeaveMinutes: 0, otMinutes: 0 });
  });

  it("ออกก่อนเวลากะ 30 นาที -> LEFT_EARLY", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60, clockOutMinuteOfDay: 17 * 60 + 30 });
    expect(result.status).toBe("LEFT_EARLY");
    expect(result.earlyLeaveMinutes).toBe(30);
  });

  it("ออกหลังเวลากะ 45 นาที -> OT 45 นาที สถานะ ON_TIME (มาตรงเวลา)", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60, clockOutMinuteOfDay: 18 * 60 + 45 });
    expect(result.status).toBe("ON_TIME");
    expect(result.otMinutes).toBe(45);
  });

  it("มาสายและออกก่อนเวลาทั้งคู่ -> LATE_AND_LEFT_EARLY", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60 + 10, clockOutMinuteOfDay: 17 * 60 + 50 });
    expect(result.status).toBe("LATE_AND_LEFT_EARLY");
    expect(result.lateMinutes).toBe(10);
    expect(result.earlyLeaveMinutes).toBe(10);
  });

  it("มาสายแต่ทำ OT ต่อจนเกินเวลากะ -> LATE พร้อม otMinutes > 0", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60 + 20, clockOutMinuteOfDay: 19 * 60 });
    expect(result.status).toBe("LATE");
    expect(result.lateMinutes).toBe(20);
    expect(result.otMinutes).toBe(60);
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("ยังไม่ลงเวลาออก -> earlyLeaveMinutes และ otMinutes เป็น 0 เสมอ ไม่ว่าจะเข้าสายแค่ไหน", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 11 * 60, clockOutMinuteOfDay: null });
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.otMinutes).toBe(0);
    expect(result.status).toBe("LATE");
  });

  it("เข้า-ออกภายในนาทีเดียวกับกะ (กะสั้นมาก) ยังคำนวณถูกต้อง", () => {
    const result = evaluateAttendance({ shiftStartMin: 600, shiftEndMin: 601, clockInMinuteOfDay: 600, clockOutMinuteOfDay: 601 });
    expect(result).toEqual({ status: "ON_TIME", lateMinutes: 0, earlyLeaveMinutes: 0, otMinutes: 0 });
  });

  it("กะเริ่มเที่ยงคืนพอดี (0 นาที) ไม่ทำให้คำนวณพัง", () => {
    const result = evaluateAttendance({ shiftStartMin: 0, shiftEndMin: 480, clockInMinuteOfDay: 10, clockOutMinuteOfDay: 480 });
    expect(result.status).toBe("LATE");
    expect(result.lateMinutes).toBe(10);
  });

  it("ออกก่อนเวลาและมี OT พร้อมกันไม่เกิดขึ้นจริง (คนละทิศทาง) แต่ยืนยันว่าไม่เกิด edge case ผิด", () => {
    const result = evaluateAttendance({ ...SHIFT, clockInMinuteOfDay: 9 * 60, clockOutMinuteOfDay: 17 * 60 });
    expect(result.earlyLeaveMinutes).toBe(60);
    expect(result.otMinutes).toBe(0);
  });
});

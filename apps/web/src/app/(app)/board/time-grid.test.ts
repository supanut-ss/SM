import { describe, expect, it } from "vitest";
import {
  durationMinutes,
  durationToWidth,
  minutesToTime,
  snapMinutes,
  timeToX,
  xToMinutesFromStart,
  type TimeGridConfig,
} from "./time-grid";

const config: TimeGridConfig = { dayStart: new Date("2026-09-01T02:00:00.000Z"), pxPerMin: 2 };

describe("timeToX", () => {
  it("คืน 0 ที่จุดเริ่มกระดานพอดี", () => {
    expect(timeToX(config.dayStart, config)).toBe(0);
  });

  it("คำนวณตำแหน่งพิกเซลถูกต้องตาม pxPerMin", () => {
    const time = new Date(config.dayStart.getTime() + 60 * 60_000); // +60 นาที
    expect(timeToX(time, config)).toBe(120); // 60 * 2
  });

  it("เวลาก่อนจุดเริ่มกระดานได้ค่าติดลบ", () => {
    const time = new Date(config.dayStart.getTime() - 30 * 60_000);
    expect(timeToX(time, config)).toBe(-60);
  });
});

describe("xToMinutesFromStart", () => {
  it("แปลงกลับจากพิกเซลเป็นนาทีถูกต้อง", () => {
    expect(xToMinutesFromStart(120, config)).toBe(60);
  });
});

describe("snapMinutes", () => {
  it("ปัดเข้ากริด 15 นาทีที่ใกล้ที่สุด", () => {
    expect(snapMinutes(7, 15)).toBe(0);
    expect(snapMinutes(8, 15)).toBe(15);
    expect(snapMinutes(22, 15)).toBe(15);
    expect(snapMinutes(23, 15)).toBe(30);
  });

  it("ปัดเข้ากริด 30 นาที", () => {
    expect(snapMinutes(44, 30)).toBe(30);
    expect(snapMinutes(46, 30)).toBe(60);
  });

  it("ค่าที่ตรงกริดอยู่แล้วไม่เปลี่ยน", () => {
    expect(snapMinutes(60, 15)).toBe(60);
  });
});

describe("minutesToTime", () => {
  it("บวกนาทีเข้ากับจุดเริ่มถูกต้อง", () => {
    const result = minutesToTime(config.dayStart, 90);
    expect(result.toISOString()).toBe("2026-09-01T03:30:00.000Z");
  });

  it("นาทีติดลบย้อนเวลากลับไปก่อนจุดเริ่ม", () => {
    const result = minutesToTime(config.dayStart, -30);
    expect(result.toISOString()).toBe("2026-09-01T01:30:00.000Z");
  });
});

describe("durationMinutes", () => {
  it("คำนวณความยาวเป็นนาทีถูกต้อง", () => {
    const start = new Date("2026-09-01T09:00:00.000Z");
    const end = new Date("2026-09-01T10:30:00.000Z");
    expect(durationMinutes(start, end)).toBe(90);
  });
});

describe("durationToWidth", () => {
  it("คำนวณความกว้างพิกเซลจากช่วงเวลาตาม pxPerMin", () => {
    const start = config.dayStart;
    const end = new Date(start.getTime() + 45 * 60_000);
    expect(durationToWidth(start, end, config)).toBe(90); // 45 * 2
  });
});

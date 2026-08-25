import { describe, expect, it } from "vitest";
import { bangkokDayRange, bangkokMinutesToInstant, toBangkokDateOnly } from "./bangkok-date";

describe("toBangkokDateOnly", () => {
  it("เวลาช่วงกลางวันไทยตกวันเดียวกับ UTC (ไม่ข้ามวัน)", () => {
    // 2026-09-01T10:00:00Z = 2026-09-01T17:00 ไทย
    expect(toBangkokDateOnly(new Date("2026-09-01T10:00:00.000Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("เวลาดึกฝั่ง UTC ที่จริงเป็นเช้าวันถัดไปแล้วในไทย ต้องนับเป็นวันถัดไป", () => {
    // 2026-09-01T20:00:00Z = 2026-09-02T03:00 ไทย
    expect(toBangkokDateOnly(new Date("2026-09-01T20:00:00.000Z")).toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
  });

  it("เที่ยงคืนไทยพอดี (17:00 UTC ของวันก่อนหน้า) ต้องนับเป็นวันใหม่แล้ว", () => {
    // 2026-09-01T17:00:00Z = 2026-09-02T00:00 ไทยพอดี
    expect(toBangkokDateOnly(new Date("2026-09-01T17:00:00.000Z")).toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
  });

  it("1 มิลลิวินาทีก่อนเที่ยงคืนไทย ยังนับเป็นวันเดิม", () => {
    expect(toBangkokDateOnly(new Date("2026-09-01T16:59:59.999Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
});

describe("bangkokDayRange", () => {
  it("คืนช่วง UTC ที่ครอบทั้งวันไทยพอดี (17:00 UTC วันก่อนหน้า ถึง 17:00 UTC วันเดียวกัน)", () => {
    const { start, end } = bangkokDayRange(new Date("2026-09-01T10:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T17:00:00.000Z");
  });

  it("ระยะห่างระหว่าง start กับ end ต้องเป็น 24 ชั่วโมงพอดีเสมอ", () => {
    const { start, end } = bangkokDayRange(new Date("2026-09-01T20:00:00.000Z"));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60_000);
  });
});

describe("bangkokMinutesToInstant", () => {
  it("09:00 (540 นาที) ของวัน label ตรงกับ 02:00 UTC ของวันเดียวกัน", () => {
    const dateLabel = new Date("2026-09-01T00:00:00.000Z");
    expect(bangkokMinutesToInstant(dateLabel, 9 * 60).toISOString()).toBe("2026-09-01T02:00:00.000Z");
  });

  it("00:00 (0 นาที) ตรงกับ 17:00 UTC ของวันก่อนหน้า", () => {
    const dateLabel = new Date("2026-09-01T00:00:00.000Z");
    expect(bangkokMinutesToInstant(dateLabel, 0).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });
});

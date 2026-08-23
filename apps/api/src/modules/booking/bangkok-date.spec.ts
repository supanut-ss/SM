import { describe, expect, it } from "vitest";
import { toBangkokDateOnly } from "./bangkok-date";

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

import { describe, expect, it } from "vitest";
import { bangkokDayOfWeek, bangkokMinuteOfDay, bangkokMonth } from "./bangkok-time";

describe("bangkokDayOfWeek", () => {
  it("returns the Thai wall-clock weekday even when UTC is still the previous day", () => {
    // 2026-08-24T20:00:00Z (Mon UTC) = 2026-08-25T03:00 ไทย (Tue)
    expect(bangkokDayOfWeek(new Date("2026-08-24T20:00:00.000Z"))).toBe(2);
  });

  it("returns the Thai wall-clock weekday when UTC and Thai time are the same calendar day", () => {
    // 2026-08-24T10:00:00Z (Mon) = 2026-08-24T17:00 ไทย (still Mon)
    expect(bangkokDayOfWeek(new Date("2026-08-24T10:00:00.000Z"))).toBe(1);
  });
});

describe("bangkokMinuteOfDay", () => {
  it("converts 09:00 UTC to 16:00 Thai time (960 minutes)", () => {
    expect(bangkokMinuteOfDay(new Date("2026-08-24T09:00:00.000Z"))).toBe(16 * 60);
  });

  it("wraps correctly right after Thai midnight", () => {
    // 17:00 UTC = 00:00 ไทยพอดี
    expect(bangkokMinuteOfDay(new Date("2026-08-24T17:00:00.000Z"))).toBe(0);
  });
});

describe("bangkokMonth", () => {
  it("returns the Thai wall-clock month (1-12)", () => {
    expect(bangkokMonth(new Date("2026-08-24T10:00:00.000Z"))).toBe(8);
  });

  it("rolls over to the next month when Thai time has crossed midnight into a new month", () => {
    // 2026-08-31T20:00:00Z = 2026-09-01T03:00 ไทย
    expect(bangkokMonth(new Date("2026-08-31T20:00:00.000Z"))).toBe(9);
  });
});

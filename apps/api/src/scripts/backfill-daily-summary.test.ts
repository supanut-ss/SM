import { describe, expect, it } from "vitest";
import { parseDateRangeArgs } from "./backfill-daily-summary.util";

// today ถูกกำหนดเป็นเที่ยงวัน UTC ของ 2026-08-27 (= 19:00 เวลาไทย, ยังอยู่ในวันเดียวกัน) เพื่อให้แน่ใจว่า
// การแปลงเป็นวันปฏิทินไทยไม่บังเอิญไปตรงกับ UTC date เฉย ๆ
const TODAY = new Date(Date.UTC(2026, 7, 27, 12, 0, 0));

describe("parseDateRangeArgs", () => {
  it("defaults to the last 365 Bangkok calendar days ending yesterday when neither flag is given", () => {
    const { from, to } = parseDateRangeArgs([], TODAY);

    expect(to.toISOString()).toBe("2026-08-26T00:00:00.000Z"); // เมื่อวานตามปฏิทินไทย
    expect(from.toISOString()).toBe("2025-08-27T00:00:00.000Z"); // 364 วันก่อน to = ช่วง 365 วันพอดี
    const totalDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60_000)) + 1;
    expect(totalDays).toBe(365);
  });

  it("parses explicit --from and --to flags", () => {
    const { from, to } = parseDateRangeArgs(["--from=2026-01-01", "--to=2026-01-31"], TODAY);

    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("allows --from without --to (defaults --to to yesterday)", () => {
    const { from, to } = parseDateRangeArgs(["--from=2026-08-01"], TODAY);

    expect(from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("throws a readable error for a malformed date", () => {
    expect(() => parseDateRangeArgs(["--from=not-a-date"], TODAY)).toThrow(/YYYY-MM-DD/);
  });

  it("throws when --from is after --to", () => {
    expect(() => parseDateRangeArgs(["--from=2026-02-01", "--to=2026-01-01"], TODAY)).toThrow(
      /--from ต้องไม่มากกว่า --to/,
    );
  });
});

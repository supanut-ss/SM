import { describe, expect, it } from "vitest";
import {
  coursesExpiringQuerySchema,
  dailySummaryRangeQuerySchema,
  dormantCustomersQuerySchema,
  staffUtilizationQuerySchema,
} from "./reports.js";

describe("dailySummaryRangeQuerySchema", () => {
  it("accepts a valid from/to pair", () => {
    expect(dailySummaryRangeQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-31" }).success).toBe(true);
  });

  it("rejects a missing to", () => {
    expect(dailySummaryRangeQuerySchema.safeParse({ from: "2026-01-01" }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(dailySummaryRangeQuerySchema.safeParse({ from: "2026-1-1", to: "2026-01-31" }).success).toBe(false);
  });
});

describe("staffUtilizationQuerySchema", () => {
  it("accepts from/to without staffId", () => {
    const result = staffUtilizationQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-31" });
    expect(result.success).toBe(true);
  });

  it("accepts from/to with staffId", () => {
    const result = staffUtilizationQuerySchema.safeParse({
      from: "2026-01-01",
      to: "2026-01-31",
      staffId: "staff_1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty staffId", () => {
    const result = staffUtilizationQuerySchema.safeParse({
      from: "2026-01-01",
      to: "2026-01-31",
      staffId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("coursesExpiringQuerySchema", () => {
  it("accepts an omitted withinDays", () => {
    expect(coursesExpiringQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces a numeric string withinDays", () => {
    const result = coursesExpiringQuerySchema.safeParse({ withinDays: "30" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.withinDays).toBe(30);
  });

  it("rejects a zero withinDays", () => {
    expect(coursesExpiringQuerySchema.safeParse({ withinDays: "0" }).success).toBe(false);
  });

  it("rejects a negative withinDays", () => {
    expect(coursesExpiringQuerySchema.safeParse({ withinDays: "-5" }).success).toBe(false);
  });

  it("rejects a non-integer withinDays", () => {
    expect(coursesExpiringQuerySchema.safeParse({ withinDays: "1.5" }).success).toBe(false);
  });
});

describe("dormantCustomersQuerySchema", () => {
  it("accepts an omitted daysSinceLastVisit", () => {
    expect(dormantCustomersQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces a numeric string daysSinceLastVisit", () => {
    const result = dormantCustomersQuerySchema.safeParse({ daysSinceLastVisit: "60" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.daysSinceLastVisit).toBe(60);
  });

  it("rejects a negative daysSinceLastVisit", () => {
    expect(dormantCustomersQuerySchema.safeParse({ daysSinceLastVisit: "-1" }).success).toBe(false);
  });
});

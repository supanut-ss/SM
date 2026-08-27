import { describe, expect, it } from "vitest";
import { reopenPayrollPeriodSchema } from "./payroll.js";

describe("reopenPayrollPeriodSchema", () => {
  it("accepts a valid approval token", () => {
    const result = reopenPayrollPeriodSchema.safeParse({ approvalToken: "token123" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty approval token", () => {
    const result = reopenPayrollPeriodSchema.safeParse({ approvalToken: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing approvalToken", () => {
    const result = reopenPayrollPeriodSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { closeCashierShiftSchema, reopenCashierShiftSchema } from "./cashier-shift.js";

describe("closeCashierShiftSchema", () => {
  it("accepts a close with no variance reason", () => {
    const result = closeCashierShiftSchema.safeParse({ countedCashSatang: 30000 });
    expect(result.success).toBe(true);
  });

  it("accepts a close with a variance reason", () => {
    const result = closeCashierShiftSchema.safeParse({
      countedCashSatang: 29500,
      varianceReason: "ทอนเงินผิดให้ลูกค้าคนหนึ่ง",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative counted cash amount", () => {
    const result = closeCashierShiftSchema.safeParse({ countedCashSatang: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing countedCashSatang", () => {
    const result = closeCashierShiftSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("reopenCashierShiftSchema", () => {
  it("accepts a valid approval token", () => {
    const result = reopenCashierShiftSchema.safeParse({ approvalToken: "token123" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing approvalToken", () => {
    const result = reopenCashierShiftSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

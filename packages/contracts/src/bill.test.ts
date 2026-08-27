import { describe, expect, it } from "vitest";
import { cancelBillSchema, checkoutBillSchema, recordBillTipSchema } from "./bill.js";

describe("checkoutBillSchema", () => {
  const basePayment = { method: "CASH" as const, amountSatang: 30000 };

  it("accepts a bill with a single service job line", () => {
    const result = checkoutBillSchema.safeParse({
      serviceJobLines: [{ serviceJobId: "job_1" }],
      payments: [basePayment],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a bill with a single product line", () => {
    const result = checkoutBillSchema.safeParse({
      productLines: [{ description: "ครีมบำรุงผิว", priceSatang: 50000, paymentMethod: "CASH" }],
      payments: [basePayment],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bill with no lines at all", () => {
    const result = checkoutBillSchema.safeParse({ payments: [basePayment] });
    expect(result.success).toBe(false);
  });

  it("rejects a bill with no payments", () => {
    const result = checkoutBillSchema.safeParse({
      serviceJobLines: [{ serviceJobId: "job_1" }],
      payments: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a memberPackageId on a service job line", () => {
    const result = checkoutBillSchema.safeParse({
      serviceJobLines: [{ serviceJobId: "job_1", memberPackageId: "mp_1" }],
      payments: [basePayment],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a tenderedSatang for change calculation", () => {
    const result = checkoutBillSchema.safeParse({
      serviceJobLines: [{ serviceJobId: "job_1" }],
      payments: [{ method: "CASH", amountSatang: 30000, tenderedSatang: 50000 }],
    });
    expect(result.success).toBe(true);
  });

  it("uppercases the coupon code", () => {
    const result = checkoutBillSchema.safeParse({
      serviceJobLines: [{ serviceJobId: "job_1" }],
      payments: [basePayment],
      couponCode: "summer10",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponCode).toBe("SUMMER10");
  });

  it("does not accept a promotionId or discountSatang field even if the client sends one (server always computes)", () => {
    const result = checkoutBillSchema.safeParse({
      serviceJobLines: [{ serviceJobId: "job_1" }],
      payments: [basePayment],
      promotionId: "promo_1",
      discountSatang: 99999,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data.promotionId).toBeUndefined();
      expect(data.discountSatang).toBeUndefined();
    }
  });

  it("rejects a negative product price", () => {
    const result = checkoutBillSchema.safeParse({
      productLines: [{ description: "x", priceSatang: -1, paymentMethod: "CASH" }],
      payments: [basePayment],
    });
    expect(result.success).toBe(false);
  });
});

describe("cancelBillSchema", () => {
  it("accepts a valid cancellation", () => {
    const result = cancelBillSchema.safeParse({ approvalToken: "token123", reason: "ลูกค้าจองผิดคน" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing approvalToken", () => {
    const result = cancelBillSchema.safeParse({ reason: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing reason", () => {
    const result = cancelBillSchema.safeParse({ approvalToken: "token123" });
    expect(result.success).toBe(false);
  });
});

describe("recordBillTipSchema", () => {
  it("accepts a valid cash/transfer split", () => {
    const result = recordBillTipSchema.safeParse({ cashSatang: 5000, transferSatang: 3000 });
    expect(result.success).toBe(true);
  });

  it("rejects both cashSatang and transferSatang being zero", () => {
    const result = recordBillTipSchema.safeParse({ cashSatang: 0, transferSatang: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative cashSatang", () => {
    const result = recordBillTipSchema.safeParse({ cashSatang: -1, transferSatang: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative transferSatang", () => {
    const result = recordBillTipSchema.safeParse({ cashSatang: 0, transferSatang: -1 });
    expect(result.success).toBe(false);
  });
});

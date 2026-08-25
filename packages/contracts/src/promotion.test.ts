import { describe, expect, it } from "vitest";
import {
  calculatePromotionsSchema,
  createCouponSchema,
  createPromotionSchema,
  updateCouponSchema,
  updatePromotionSchema,
} from "./promotion.js";

const percentOff = {
  type: "PERCENT_OFF" as const,
  name: "ลด 10% วันธรรมดา",
  percentOff: 10,
};

describe("createPromotionSchema", () => {
  it("accepts a PERCENT_OFF promotion", () => {
    const result = createPromotionSchema.safeParse(percentOff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(0);
    }
  });

  it("accepts an AMOUNT_OFF promotion", () => {
    const result = createPromotionSchema.safeParse({
      type: "AMOUNT_OFF",
      name: "ลด 100 บาท",
      amountOffSatang: 10000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a FIXED_PRICE promotion", () => {
    const result = createPromotionSchema.safeParse({
      type: "FIXED_PRICE",
      name: "ราคาพิเศษ 199",
      fixedPriceSatang: 19900,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a BUY_X_GET_Y promotion", () => {
    const result = createPromotionSchema.safeParse({
      type: "BUY_X_GET_Y",
      name: "ซื้อ 2 แถม 1",
      buyQuantity: 2,
      getQuantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a BONUS_MINUTES promotion", () => {
    const result = createPromotionSchema.safeParse({
      type: "BONUS_MINUTES",
      name: "แถม 15 นาที",
      bonusMinutes: 15,
    });
    expect(result.success).toBe(true);
  });

  it("rejects percentOff over 100", () => {
    const result = createPromotionSchema.safeParse({ ...percentOff, percentOff: 150 });
    expect(result.success).toBe(false);
  });

  it("rejects percentOff of 0", () => {
    const result = createPromotionSchema.safeParse({ ...percentOff, percentOff: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createPromotionSchema.safeParse({ ...percentOff, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const result = createPromotionSchema.safeParse({ ...percentOff, type: "MYSTERY" });
    expect(result.success).toBe(false);
  });

  it("does not accept a stackable field even if the client sends one (no such field in this system)", () => {
    const result = createPromotionSchema.safeParse({ ...percentOff, stackable: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).stackable).toBeUndefined();
    }
  });

  it("accepts full conditions", () => {
    const result = createPromotionSchema.safeParse({
      ...percentOff,
      minSpendSatang: 50000,
      serviceVariantIds: ["sv_1"],
      daysOfWeek: [1, 2, 3, 4, 5],
      startMinuteOfDay: 540,
      endMinuteOfDay: 1020,
      firstTimeCustomerOnly: true,
      birthdayMonthOnly: false,
      memberTiers: ["GOLD"],
      quotaTotal: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range day of week", () => {
    const result = createPromotionSchema.safeParse({ ...percentOff, daysOfWeek: [7] });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amountOffSatang", () => {
    const result = createPromotionSchema.safeParse({
      type: "AMOUNT_OFF",
      name: "x",
      amountOffSatang: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePromotionSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    expect(updatePromotionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts isActive alone", () => {
    expect(updatePromotionSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("does not accept a type or percentOff field (immutable post-creation)", () => {
    const result = updatePromotionSchema.safeParse({ type: "AMOUNT_OFF", percentOff: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data.type).toBeUndefined();
      expect(data.percentOff).toBeUndefined();
    }
  });

  it("accepts clearing quotaTotal back to unlimited via null", () => {
    const result = updatePromotionSchema.safeParse({ quotaTotal: null });
    expect(result.success).toBe(true);
  });
});

describe("createCouponSchema", () => {
  it("accepts and uppercases a code", () => {
    const result = createCouponSchema.safeParse({ code: "summer10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("SUMMER10");
  });

  it("rejects an empty code", () => {
    expect(createCouponSchema.safeParse({ code: "" }).success).toBe(false);
  });

  it("accepts an optional maxRedemptions", () => {
    expect(createCouponSchema.safeParse({ code: "x", maxRedemptions: 50 }).success).toBe(true);
  });

  it("rejects maxRedemptions of 0", () => {
    expect(createCouponSchema.safeParse({ code: "x", maxRedemptions: 0 }).success).toBe(false);
  });
});

describe("updateCouponSchema", () => {
  it("accepts isActive alone", () => {
    expect(updateCouponSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("accepts clearing maxRedemptions via null", () => {
    expect(updateCouponSchema.safeParse({ maxRedemptions: null }).success).toBe(true);
  });
});

describe("calculatePromotionsSchema", () => {
  const cart = [{ serviceVariantId: "sv_1", priceSatang: 30000, paymentMethod: "CASH" as const }];

  it("accepts a minimal cart", () => {
    const result = calculatePromotionsSchema.safeParse({ cart });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isFirstTimeCustomer).toBe(false);
      expect(result.data.cart[0]!.quantity).toBe(1);
    }
  });

  it("rejects an empty cart", () => {
    expect(calculatePromotionsSchema.safeParse({ cart: [] }).success).toBe(false);
  });

  it("uppercases the coupon code", () => {
    const result = calculatePromotionsSchema.safeParse({ cart, couponCode: "abc123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponCode).toBe("ABC123");
  });

  it("rejects an invalid payment method", () => {
    const result = calculatePromotionsSchema.safeParse({
      cart: [{ ...cart[0], paymentMethod: "CRYPTO" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a birth month outside 1-12", () => {
    const result = calculatePromotionsSchema.safeParse({ cart, memberBirthMonth: 13 });
    expect(result.success).toBe(false);
  });
});

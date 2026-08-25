import { describe, expect, it } from "vitest";
import { evaluatePromotions } from "./index.js";
import type { CartLine, EvaluatePromotionsInput, PromotionRule } from "./types.js";

const BASE_INPUT: Omit<EvaluatePromotionsInput, "cart" | "promotions"> = {
  dayOfWeek: 3, // Wed
  minuteOfDay: 10 * 60, // 10:00
  currentMonth: 8,
  branchId: "branch_1",
  memberTier: null,
  isFirstTimeCustomer: false,
  memberBirthMonth: null,
};

const cashLine = (overrides: Partial<CartLine> = {}): CartLine => ({
  serviceVariantId: "sv_thai_60",
  priceSatang: 30000,
  paymentMethod: "CASH",
  quantity: 1,
  ...overrides,
});

const percentOff20: PromotionRule = {
  id: "promo_percent20",
  name: "ลด 20%",
  type: "PERCENT_OFF",
  priority: 1,
  percentOff: 20,
  conditions: {},
  quotaRemaining: null,
};

function run(cart: CartLine[], promotions: PromotionRule[], overrides: Partial<EvaluatePromotionsInput> = {}) {
  return evaluatePromotions({ ...BASE_INPUT, cart, promotions, ...overrides });
}

describe("evaluatePromotions — PERCENT_OFF", () => {
  it("applies a percent discount to the eligible subtotal", () => {
    const result = run([cashLine({ priceSatang: 100000 })], [percentOff20]);
    expect(result.applied?.discountSatang).toBe(20000);
    expect(result.applied?.promotionId).toBe("promo_percent20");
  });

  it("computes the percent discount across multiple matching lines", () => {
    const result = run(
      [cashLine({ priceSatang: 30000 }), cashLine({ priceSatang: 20000 })],
      [percentOff20],
    );
    expect(result.applied?.discountSatang).toBe(10000);
  });

  it("rounds the percent discount to the nearest satang", () => {
    const oddPercent: PromotionRule = { ...percentOff20, percentOff: 33 };
    const result = run([cashLine({ priceSatang: 10000 })], [oddPercent]);
    expect(result.applied?.discountSatang).toBe(3300);
  });
});

describe("evaluatePromotions — AMOUNT_OFF", () => {
  const amountOff50: PromotionRule = {
    id: "promo_amount50",
    name: "ลด 500 บาท",
    type: "AMOUNT_OFF",
    priority: 1,
    amountOffSatang: 50000,
    conditions: {},
    quotaRemaining: null,
  };

  it("applies a flat amount discount", () => {
    const result = run([cashLine({ priceSatang: 100000 })], [amountOff50]);
    expect(result.applied?.discountSatang).toBe(50000);
  });

  it("caps the discount at the eligible subtotal (never goes negative)", () => {
    const result = run([cashLine({ priceSatang: 30000 })], [amountOff50]);
    expect(result.applied?.discountSatang).toBe(30000);
  });
});

describe("evaluatePromotions — FIXED_PRICE", () => {
  const fixedPrice199: PromotionRule = {
    id: "promo_fixed199",
    name: "ราคาพิเศษ 199",
    type: "FIXED_PRICE",
    priority: 1,
    fixedPriceSatang: 19900,
    conditions: {},
    quotaRemaining: null,
  };

  it("discounts down to the fixed price for a single matching line", () => {
    const result = run([cashLine({ priceSatang: 30000 })], [fixedPrice199]);
    expect(result.applied?.discountSatang).toBe(10100);
  });

  it("rejects when more than one line is eligible (fixed price is single-item only)", () => {
    const result = run([cashLine(), cashLine({ serviceVariantId: "sv_other" })], [fixedPrice199]);
    expect(result.applied).toBeNull();
    expect(result.rejected[0]!.reason).toContain("บริการเดียว");
  });

  it("rejects when the fixed price is not actually cheaper than the line", () => {
    const result = run([cashLine({ priceSatang: 10000 })], [fixedPrice199]);
    expect(result.applied).toBeNull();
  });
});

describe("evaluatePromotions — BUY_X_GET_Y", () => {
  const buy2Get1: PromotionRule = {
    id: "promo_buy2get1",
    name: "ซื้อ 2 แถม 1",
    type: "BUY_X_GET_Y",
    priority: 1,
    buyQuantity: 2,
    getQuantity: 1,
    conditions: {},
    quotaRemaining: null,
  };

  it("grants a free unit once the buy quantity is met", () => {
    const result = run(
      [cashLine({ priceSatang: 30000, quantity: 2 })],
      [buy2Get1],
    );
    expect(result.applied?.discountSatang).toBe(30000);
  });

  it("does not apply below the buy quantity threshold", () => {
    const result = run([cashLine({ priceSatang: 30000, quantity: 1 })], [buy2Get1]);
    expect(result.applied).toBeNull();
  });

  it("gives away the cheapest units first to minimize the store's cost", () => {
    const result = run(
      [
        cashLine({ serviceVariantId: "sv_a", priceSatang: 50000, quantity: 1 }),
        cashLine({ serviceVariantId: "sv_b", priceSatang: 10000, quantity: 1 }),
      ],
      [buy2Get1],
    );
    // ซื้อครบ 2 ชิ้น แถม 1 — ต้องแถมชิ้นถูกกว่า (10000) ไม่ใช่ชิ้นแพง (50000)
    expect(result.applied?.discountSatang).toBe(10000);
  });

  it("scales the free count with multiples of the buy quantity", () => {
    const result = run([cashLine({ priceSatang: 10000, quantity: 4 })], [buy2Get1]);
    // ซื้อ 4 = ครบ 2 รอบ x แถม 1 = แถม 2 ชิ้น
    expect(result.applied?.discountSatang).toBe(20000);
  });
});

describe("evaluatePromotions — BONUS_MINUTES", () => {
  const bonus15Min: PromotionRule = {
    id: "promo_bonus15",
    name: "แถม 15 นาที",
    type: "BONUS_MINUTES",
    priority: 1,
    bonusMinutes: 15,
    conditions: {},
    quotaRemaining: null,
  };

  it("grants bonus minutes with zero monetary discount", () => {
    const result = run([cashLine()], [bonus15Min]);
    expect(result.applied?.bonusMinutes).toBe(15);
    expect(result.applied?.discountSatang).toBe(0);
  });

  it("loses to any promotion with a nonzero monetary discount", () => {
    const result = run([cashLine({ priceSatang: 100000 })], [bonus15Min, percentOff20]);
    expect(result.applied?.promotionId).toBe("promo_percent20");
    expect(result.rejected.some((r) => r.promotionId === "promo_bonus15")).toBe(true);
  });
});

describe("evaluatePromotions — no stacking (docs/DOMAIN.md ข้อ 15)", () => {
  it("picks the single promotion with the largest discount among 3 simultaneously eligible promotions", () => {
    const promo10: PromotionRule = { ...percentOff20, id: "p10", name: "ลด 10%", percentOff: 10 };
    const promo20: PromotionRule = { ...percentOff20, id: "p20", name: "ลด 20%", percentOff: 20 };
    const promo15: PromotionRule = { ...percentOff20, id: "p15", name: "ลด 15%", percentOff: 15 };

    const result = run([cashLine({ priceSatang: 100000 })], [promo10, promo20, promo15]);

    expect(result.applied?.promotionId).toBe("p20");
    expect(result.applied?.discountSatang).toBe(20000);
    // อีก 2 โปรฯ ที่เหลือต้องถูกปฏิเสธพร้อมเหตุผลชัดเจน ไม่ใช่หายไปเงียบ ๆ
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected.map((r) => r.promotionId).sort()).toEqual(["p10", "p15"]);
    for (const r of result.rejected) {
      expect(r.reason).toContain("ลด 20%");
    }
  });

  it("breaks an exact tie in discount amount using priority (higher wins)", () => {
    const lowPriority: PromotionRule = { ...percentOff20, id: "low", priority: 1 };
    const highPriority: PromotionRule = { ...percentOff20, id: "high", priority: 5 };
    const result = run([cashLine({ priceSatang: 100000 })], [lowPriority, highPriority]);
    expect(result.applied?.promotionId).toBe("high");
  });

  it("never applies two promotions to the same bill even when both are eligible and equally good", () => {
    const a: PromotionRule = { ...percentOff20, id: "a", priority: 1 };
    const b: PromotionRule = { ...percentOff20, id: "b", priority: 1 };
    const result = run([cashLine({ priceSatang: 100000 })], [a, b]);
    expect(result.applied).not.toBeNull();
    expect(result.rejected).toHaveLength(1);
  });
});

describe("evaluatePromotions — ห้ามใช้โปรฯ กับรายการที่ตัดคอร์ส (docs/PLAN.md T5.3 เกณฑ์ผ่าน)", () => {
  it("never discounts a line paid via PACKAGE deduction", () => {
    const result = run([cashLine({ paymentMethod: "PACKAGE", priceSatang: 100000 })], [percentOff20]);
    expect(result.applied).toBeNull();
    expect(result.rejected[0]!.reason).toContain("ตัดคอร์ส");
  });

  it("only discounts the cash portion when the cart mixes cash and package lines", () => {
    const result = run(
      [cashLine({ priceSatang: 100000, paymentMethod: "PACKAGE" }), cashLine({ priceSatang: 50000 })],
      [percentOff20],
    );
    expect(result.applied?.discountSatang).toBe(10000);
  });

  it("never discounts a VOUCHER or COMPLIMENTARY line beyond what CASH-equivalent logic allows (both remain promotable, only PACKAGE is excluded)", () => {
    const result = run([cashLine({ priceSatang: 100000, paymentMethod: "VOUCHER" })], [percentOff20]);
    expect(result.applied?.discountSatang).toBe(20000);
  });
});

describe("evaluatePromotions — conditions", () => {
  it("rejects when the bill total is below minSpendSatang", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { minSpendSatang: 100000 } };
    const result = run([cashLine({ priceSatang: 50000 })], [rule]);
    expect(result.applied).toBeNull();
    expect(result.rejected[0]!.reason).toContain("ขั้นต่ำ");
  });

  it("counts the full cart (including package-paid lines) toward minSpendSatang", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { minSpendSatang: 100000 } };
    const result = run(
      [cashLine({ priceSatang: 60000, paymentMethod: "PACKAGE" }), cashLine({ priceSatang: 50000 })],
      [rule],
    );
    expect(result.applied?.discountSatang).toBe(10000);
  });

  it("restricts to matching serviceVariantIds", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { serviceVariantIds: ["sv_oil_90"] } };
    const result = run([cashLine({ serviceVariantId: "sv_thai_60" })], [rule]);
    expect(result.applied).toBeNull();
  });

  it("restricts to matching branchIds", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { branchIds: ["branch_2"] } };
    const result = run([cashLine()], [rule]);
    expect(result.applied).toBeNull();
  });

  it("restricts to matching daysOfWeek", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { daysOfWeek: [0, 6] } };
    const result = run([cashLine()], [rule]); // BASE_INPUT.dayOfWeek = 3 (Wed)
    expect(result.applied).toBeNull();
  });

  it("restricts to a time-of-day window", () => {
    const rule: PromotionRule = {
      ...percentOff20,
      conditions: { startMinuteOfDay: 13 * 60, endMinuteOfDay: 17 * 60 },
    };
    const result = run([cashLine()], [rule]); // BASE_INPUT.minuteOfDay = 10:00
    expect(result.applied).toBeNull();
  });

  it("applies within the time-of-day window boundaries inclusively", () => {
    const rule: PromotionRule = {
      ...percentOff20,
      conditions: { startMinuteOfDay: 9 * 60, endMinuteOfDay: 10 * 60 },
    };
    const result = run([cashLine()], [rule]);
    expect(result.applied).not.toBeNull();
  });

  it("restricts to first-time customers only", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { firstTimeCustomerOnly: true } };
    const result = run([cashLine()], [rule], { isFirstTimeCustomer: false });
    expect(result.applied).toBeNull();
  });

  it("allows first-time-only promotions when the customer is first-time", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { firstTimeCustomerOnly: true } };
    const result = run([cashLine()], [rule], { isFirstTimeCustomer: true });
    expect(result.applied).not.toBeNull();
  });

  it("restricts to the member's birthday month", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { birthdayMonthOnly: true } };
    const result = run([cashLine()], [rule], { memberBirthMonth: 1, currentMonth: 8 });
    expect(result.applied).toBeNull();
  });

  it("applies the birthday promotion in the matching month", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { birthdayMonthOnly: true } };
    const result = run([cashLine()], [rule], { memberBirthMonth: 8, currentMonth: 8 });
    expect(result.applied).not.toBeNull();
  });

  it("restricts to matching member tiers", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { memberTiers: ["GOLD"] } };
    const result = run([cashLine()], [rule], { memberTier: "SILVER" });
    expect(result.applied).toBeNull();
  });

  it("applies when the member tier matches", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { memberTiers: ["GOLD", "SILVER"] } };
    const result = run([cashLine()], [rule], { memberTier: "SILVER" });
    expect(result.applied).not.toBeNull();
  });
});

describe("evaluatePromotions — quota", () => {
  it("rejects an exhausted promotion (quotaRemaining = 0)", () => {
    const rule: PromotionRule = { ...percentOff20, quotaRemaining: 0 };
    const result = run([cashLine()], [rule]);
    expect(result.applied).toBeNull();
    expect(result.rejected[0]!.reason).toContain("โควตา");
  });

  it("allows a promotion with remaining quota", () => {
    const rule: PromotionRule = { ...percentOff20, quotaRemaining: 1 };
    const result = run([cashLine()], [rule]);
    expect(result.applied).not.toBeNull();
  });

  it("treats null quota as unlimited", () => {
    const rule: PromotionRule = { ...percentOff20, quotaRemaining: null };
    const result = run([cashLine()], [rule]);
    expect(result.applied).not.toBeNull();
  });
});

describe("evaluatePromotions — no applicable promotions", () => {
  it("returns applied=null with an empty cart and no promotions", () => {
    const result = run([], []);
    expect(result.applied).toBeNull();
    expect(result.rejected).toHaveLength(0);
  });

  it("returns applied=null when every promotion is rejected", () => {
    const rule: PromotionRule = { ...percentOff20, conditions: { branchIds: ["other-branch"] } };
    const result = run([cashLine()], [rule]);
    expect(result.applied).toBeNull();
    expect(result.rejected).toHaveLength(1);
  });
});

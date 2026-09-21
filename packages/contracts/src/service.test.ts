import { describe, expect, it } from "vitest";
import {
  createServiceCategorySchema,
  createServiceSchema,
  createServiceVariantSchema,
  updateServiceSchema,
  updateServiceVariantSchema,
} from "./service.js";

describe("service category schemas", () => {
  it("trims a non-empty category name", () => {
    expect(createServiceCategorySchema.parse({ name: "  นวด  " })).toEqual({ name: "นวด" });
  });

  it("rejects a blank category name", () => {
    expect(createServiceCategorySchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

const validVariant = {
  durationMin: 60,
  priceSatang: 30000,
  commissionJuniorSatang: 15000,
  commissionSeniorSatang: 18000,
  commissionMasterSatang: 21000,
  requiredSkill: "THAI_MASSAGE",
  requiredRoomTypeId: "rt_1",
};

describe("createServiceVariantSchema", () => {
  it("accepts a valid variant and defaults buffers to 0", () => {
    const result = createServiceVariantSchema.safeParse(validVariant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bufferBeforeMin).toBe(0);
      expect(result.data.bufferAfterMin).toBe(0);
    }
  });

  it("coerces numeric strings (from native <input type=number>)", () => {
    const result = createServiceVariantSchema.safeParse({
      ...validVariant,
      priceSatang: "30000",
      durationMin: "60",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceSatang).toBe(30000);
      expect(result.data.durationMin).toBe(60);
    }
  });

  it("rejects duration zero", () => {
    const result = createServiceVariantSchema.safeParse({ ...validVariant, durationMin: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = createServiceVariantSchema.safeParse({ ...validVariant, priceSatang: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer price (money must never be a float)", () => {
    const result = createServiceVariantSchema.safeParse({ ...validVariant, priceSatang: 300.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative commission rate", () => {
    const result = createServiceVariantSchema.safeParse({
      ...validVariant,
      commissionMasterSatang: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing requiredRoomTypeId", () => {
    const { requiredRoomTypeId: _requiredRoomTypeId, ...rest } = validVariant;
    const result = createServiceVariantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown requiredSkill", () => {
    const result = createServiceVariantSchema.safeParse({
      ...validVariant,
      requiredSkill: "MAGIC",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateServiceVariantSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updateServiceVariantSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updateServiceVariantSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("still enforces the price rule when price is present in a partial update", () => {
    const result = updateServiceVariantSchema.safeParse({ priceSatang: -1 });
    expect(result.success).toBe(false);
  });
});

describe("createServiceSchema", () => {
  it("accepts a service with 3 duration variants (T2.3 pass criteria)", () => {
    const result = createServiceSchema.safeParse({
      categoryId: "cat_1",
      name: "นวดไทย",
      variants: [
        validVariant,
        { ...validVariant, durationMin: 90 },
        { ...validVariant, durationMin: 120 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.variants).toHaveLength(3);
  });

  it("rejects a service with zero variants", () => {
    const result = createServiceSchema.safeParse({
      categoryId: "cat_1",
      name: "นวดไทย",
      variants: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createServiceSchema.safeParse({
      categoryId: "cat_1",
      name: "",
      variants: [validVariant],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing categoryId", () => {
    const result = createServiceSchema.safeParse({ name: "นวดไทย", variants: [validVariant] });
    expect(result.success).toBe(false);
  });

  it("treats a blank description as not provided", () => {
    const result = createServiceSchema.safeParse({
      categoryId: "cat_1",
      name: "นวดไทย",
      description: "   ",
      variants: [validVariant],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });
});

describe("updateServiceSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updateServiceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updateServiceSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("does not accept a variants field (variants are edited via updateServiceVariantSchema)", () => {
    const result = updateServiceSchema.safeParse({ variants: [validVariant] });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as Record<string, unknown>).variants).toBeUndefined();
  });
});

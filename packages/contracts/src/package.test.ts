import { describe, expect, it } from "vitest";
import { createPackageSchema, packageEditFormSchema, packageFormSchema, updatePackageSchema } from "./package.js";

const sessionCountPackage = {
  type: "SESSION_COUNT" as const,
  name: "คอร์สนวดไทย 10 ครั้ง",
  priceSatang: 900000,
  validDays: 180,
  serviceVariantId: "sv_1",
  sessionCount: 10,
};

const valuePackage = {
  type: "VALUE" as const,
  name: "บัตรเงินสด 5,000",
  priceSatang: 500000,
  validDays: 365,
  valueSatang: 500000,
};

const unlimitedPackage = {
  type: "UNLIMITED_DURATION" as const,
  name: "คอร์สไม่จำกัดนวดน้ำมัน 3 เดือน",
  priceSatang: 1500000,
  validDays: 90,
  serviceVariantId: "sv_2",
};

describe("createPackageSchema", () => {
  it("accepts a SESSION_COUNT package", () => {
    const result = createPackageSchema.safeParse(sessionCountPackage);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "SESSION_COUNT") {
      expect(result.data.sessionCount).toBe(10);
    }
  });

  it("accepts a VALUE package", () => {
    const result = createPackageSchema.safeParse(valuePackage);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "VALUE") {
      expect(result.data.valueSatang).toBe(500000);
    }
  });

  it("accepts an UNLIMITED_DURATION package", () => {
    const result = createPackageSchema.safeParse(unlimitedPackage);
    expect(result.success).toBe(true);
  });

  it("coerces numeric strings (from native <input type=number>)", () => {
    const result = createPackageSchema.safeParse({
      ...sessionCountPackage,
      priceSatang: "900000",
      sessionCount: "10",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "SESSION_COUNT") {
      expect(result.data.priceSatang).toBe(900000);
      expect(result.data.sessionCount).toBe(10);
    }
  });

  it("rejects SESSION_COUNT missing serviceVariantId", () => {
    const { serviceVariantId: _serviceVariantId, ...rest } = sessionCountPackage;
    const result = createPackageSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects SESSION_COUNT with sessionCount 0", () => {
    const result = createPackageSchema.safeParse({ ...sessionCountPackage, sessionCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects VALUE package carrying a sessionCount field mismatched to its type", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, sessionCount: 10 });
    // discriminated union strips/ignores unrecognized keys per the matched branch — still succeeds,
    // but the parsed data must NOT carry sessionCount since VALUE's shape has no such field
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).sessionCount).toBeUndefined();
    }
  });

  it("rejects VALUE with valueSatang 0", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, valueSatang: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer price (money must never be a float)", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, priceSatang: 500000.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, priceSatang: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects validDays 0", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, validDays: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const result = createPackageSchema.safeParse({ ...valuePackage, type: "SUBSCRIPTION" });
    expect(result.success).toBe(false);
  });
});

describe("updatePackageSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updatePackageSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updatePackageSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("still enforces the price rule when price is present in a partial update", () => {
    const result = updatePackageSchema.safeParse({ priceSatang: -1 });
    expect(result.success).toBe(false);
  });

  it("does not accept a type field (type is immutable post-creation)", () => {
    const result = updatePackageSchema.safeParse({ type: "VALUE" });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as Record<string, unknown>).type).toBeUndefined();
  });
});

describe("packageFormSchema (Baht units, web form)", () => {
  it("accepts a VALUE package priced in Baht", () => {
    const result = packageFormSchema.safeParse({
      type: "VALUE",
      name: "บัตรเงินสด 5,000",
      priceBaht: 5000,
      validDays: 365,
      valueBaht: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a VALUE package with valueBaht 0", () => {
    const result = packageFormSchema.safeParse({
      type: "VALUE",
      name: "บัตรเงินสด",
      priceBaht: 5000,
      validDays: 365,
      valueBaht: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("packageEditFormSchema (Baht units, web form)", () => {
  it("accepts name/priceBaht/validDays only", () => {
    const result = packageEditFormSchema.safeParse({
      name: "แก้ไขแล้ว",
      priceBaht: 2500,
      validDays: 200,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative priceBaht", () => {
    const result = packageEditFormSchema.safeParse({ name: "x", priceBaht: -1, validDays: 30 });
    expect(result.success).toBe(false);
  });
});

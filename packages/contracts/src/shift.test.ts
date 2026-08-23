import { describe, expect, it } from "vitest";
import {
  createShiftTemplateSchema,
  createStaffLeaveSchema,
  createStaffShiftSchema,
  updateShiftTemplateSchema,
} from "./shift.js";

describe("createShiftTemplateSchema", () => {
  it("accepts a valid template", () => {
    const result = createShiftTemplateSchema.safeParse({ name: "เช้า", startMin: 480, endMin: 960 });
    expect(result.success).toBe(true);
  });

  it("coerces numeric strings (from native <input type=number>)", () => {
    const result = createShiftTemplateSchema.safeParse({ name: "เช้า", startMin: "480", endMin: "960" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startMin).toBe(480);
      expect(result.data.endMin).toBe(960);
    }
  });

  it("rejects an empty name", () => {
    const result = createShiftTemplateSchema.safeParse({ name: "", startMin: 480, endMin: 960 });
    expect(result.success).toBe(false);
  });

  it("rejects endMin equal to startMin (zero-length shift)", () => {
    const result = createShiftTemplateSchema.safeParse({ name: "เช้า", startMin: 480, endMin: 480 });
    expect(result.success).toBe(false);
  });

  it("rejects endMin before startMin (overnight shifts not supported yet)", () => {
    const result = createShiftTemplateSchema.safeParse({ name: "ดึก", startMin: 1320, endMin: 120 });
    expect(result.success).toBe(false);
  });

  it("rejects startMin outside a single day", () => {
    const result = createShiftTemplateSchema.safeParse({ name: "เช้า", startMin: 1500, endMin: 1600 });
    expect(result.success).toBe(false);
  });
});

describe("updateShiftTemplateSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updateShiftTemplateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updateShiftTemplateSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("does not cross-validate startMin/endMin on a partial update (checked server-side against the existing row)", () => {
    const result = updateShiftTemplateSchema.safeParse({ endMin: 100 });
    expect(result.success).toBe(true);
  });
});

describe("createStaffShiftSchema", () => {
  it("accepts a valid assignment", () => {
    const result = createStaffShiftSchema.safeParse({
      staffId: "staff_1",
      shiftTemplateId: "tpl_1",
      date: "2026-08-24",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing staffId", () => {
    const result = createStaffShiftSchema.safeParse({ shiftTemplateId: "tpl_1", date: "2026-08-24" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing shiftTemplateId", () => {
    const result = createStaffShiftSchema.safeParse({ staffId: "staff_1", date: "2026-08-24" });
    expect(result.success).toBe(false);
  });
});

describe("createStaffLeaveSchema", () => {
  const base = { staffId: "staff_1", type: "SICK", dateFrom: "2026-08-24", dateTo: "2026-08-24" };

  it("accepts a single-day leave", () => {
    const result = createStaffLeaveSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a multi-day range", () => {
    const result = createStaffLeaveSchema.safeParse({ ...base, dateTo: "2026-08-26" });
    expect(result.success).toBe(true);
  });

  it("rejects dateTo before dateFrom", () => {
    const result = createStaffLeaveSchema.safeParse({ ...base, dateTo: "2026-08-20" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown leave type", () => {
    const result = createStaffLeaveSchema.safeParse({ ...base, type: "MAGIC" });
    expect(result.success).toBe(false);
  });

  it("treats a blank note as not provided", () => {
    const result = createStaffLeaveSchema.safeParse({ ...base, note: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeUndefined();
  });
});

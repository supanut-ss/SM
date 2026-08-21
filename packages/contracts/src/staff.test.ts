import { describe, expect, it } from "vitest";
import { createStaffSchema, updateStaffSchema } from "./staff.js";

describe("createStaffSchema", () => {
  it("accepts a minimal valid input (name, level, one skill only)", () => {
    const result = createStaffSchema.safeParse({ name: "คุณสมชาย", level: "JUNIOR", skills: ["NAIL"] });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated input", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      phone: "0812345678",
      level: "SENIOR",
      skills: ["THAI_MASSAGE", "OIL"],
      startDate: "2026-01-15",
      note: "ถนัดมือขวา",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createStaffSchema.safeParse({ name: "", level: "JUNIOR", skills: ["NAIL"] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing level", () => {
    const result = createStaffSchema.safeParse({ name: "คุณสมชาย", skills: ["NAIL"] });
    expect(result.success).toBe(false);
  });

  it("rejects a level outside the fixed enum", () => {
    const result = createStaffSchema.safeParse({ name: "คุณสมชาย", level: "EXPERT", skills: ["NAIL"] });
    expect(result.success).toBe(false);
  });

  it("rejects zero skills selected", () => {
    const result = createStaffSchema.safeParse({ name: "คุณสมชาย", level: "JUNIOR", skills: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "skills")).toBe(true);
    }
  });

  it("rejects a skill outside the fixed catalog", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["HAIRCUT"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone number that is too short", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["NAIL"],
      phone: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone number that doesn't start with 0", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["NAIL"],
      phone: "1812345678",
    });
    expect(result.success).toBe(false);
  });

  it("treats an empty-string phone as 'not provided' rather than invalid", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["NAIL"],
      phone: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeUndefined();
  });

  it("treats an empty-string note as 'not provided'", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["NAIL"],
      note: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeUndefined();
  });

  it("treats an empty-string startDate as 'not provided'", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["NAIL"],
      startDate: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startDate).toBeUndefined();
  });

  it("rejects a note longer than 1000 characters", () => {
    const result = createStaffSchema.safeParse({
      name: "คุณสมชาย",
      level: "JUNIOR",
      skills: ["NAIL"],
      note: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from the name", () => {
    const result = createStaffSchema.safeParse({
      name: "  คุณสมชาย  ",
      level: "JUNIOR",
      skills: ["NAIL"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("คุณสมชาย");
  });
});

describe("updateStaffSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updateStaffSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updateStaffSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("still enforces skills' min-1 rule when skills is present in a partial update", () => {
    const result = updateStaffSchema.safeParse({ skills: [] });
    expect(result.success).toBe(false);
  });

  it("still enforces the phone format when phone is present in a partial update", () => {
    const result = updateStaffSchema.safeParse({ phone: "not-a-phone" });
    expect(result.success).toBe(false);
  });
});

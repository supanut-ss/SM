import { describe, expect, it } from "vitest";
import { clockActionSchema, setStaffPinSchema } from "./attendance.js";

describe("setStaffPinSchema", () => {
  it("accepts a 6-digit PIN", () => {
    expect(setStaffPinSchema.safeParse({ pin: "123456" }).success).toBe(true);
  });

  it("rejects a PIN containing letters", () => {
    expect(setStaffPinSchema.safeParse({ pin: "12a456" }).success).toBe(false);
  });

  it("rejects a PIN with only 5 digits", () => {
    expect(setStaffPinSchema.safeParse({ pin: "12345" }).success).toBe(false);
  });

  it("rejects a PIN with 7 digits", () => {
    expect(setStaffPinSchema.safeParse({ pin: "1234567" }).success).toBe(false);
  });

  it("rejects a missing pin field", () => {
    expect(setStaffPinSchema.safeParse({}).success).toBe(false);
  });
});

describe("clockActionSchema", () => {
  it("accepts a valid staffId + PIN", () => {
    const result = clockActionSchema.safeParse({ staffId: "staff_1", pin: "654321" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing staffId", () => {
    const result = clockActionSchema.safeParse({ pin: "654321" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty staffId", () => {
    const result = clockActionSchema.safeParse({ staffId: "", pin: "654321" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric PIN", () => {
    const result = clockActionSchema.safeParse({ staffId: "staff_1", pin: "abcdef" });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createMemberSchema, updateMemberSchema } from "./member.js";

describe("createMemberSchema", () => {
  it("accepts a valid member", () => {
    const result = createMemberSchema.safeParse({ name: "สมหญิง ใจดี", phone: "0812345678" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createMemberSchema.safeParse({ name: "", phone: "0812345678" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing phone", () => {
    const result = createMemberSchema.safeParse({ name: "สมหญิง ใจดี" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone that is too short", () => {
    const result = createMemberSchema.safeParse({ name: "สมหญิง ใจดี", phone: "081234" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone that doesn't start with 0", () => {
    const result = createMemberSchema.safeParse({ name: "สมหญิง ใจดี", phone: "1812345678" });
    expect(result.success).toBe(false);
  });

  it("treats a blank note as not provided", () => {
    const result = createMemberSchema.safeParse({ name: "สมหญิง ใจดี", phone: "0812345678", note: "  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeUndefined();
  });

  it("defaults confirmDuplicate to undefined (not required)", () => {
    const result = createMemberSchema.safeParse({ name: "สมหญิง ใจดี", phone: "0812345678" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.confirmDuplicate).toBeUndefined();
  });

  it("accepts confirmDuplicate: true", () => {
    const result = createMemberSchema.safeParse({
      name: "สมหญิง ใจดี",
      phone: "0812345678",
      confirmDuplicate: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateMemberSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updateMemberSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("still enforces the phone format when present in a partial update", () => {
    const result = updateMemberSchema.safeParse({ phone: "123" });
    expect(result.success).toBe(false);
  });

  it("does not accept a confirmDuplicate field (only meaningful on create)", () => {
    const result = updateMemberSchema.safeParse({ confirmDuplicate: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).confirmDuplicate).toBeUndefined();
    }
  });
});

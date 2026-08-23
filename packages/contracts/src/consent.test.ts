import { describe, expect, it } from "vitest";
import { createMemberConsentSchema } from "./consent.js";

describe("createMemberConsentSchema", () => {
  const base = { type: "MARKETING", status: "GRANTED", channel: "IN_PERSON", textVersion: "v1" };

  it("accepts a valid consent grant", () => {
    const result = createMemberConsentSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a valid consent withdrawal", () => {
    const result = createMemberConsentSchema.safeParse({ ...base, status: "WITHDRAWN" });
    expect(result.success).toBe(true);
  });

  it("accepts the health-data consent type", () => {
    const result = createMemberConsentSchema.safeParse({ ...base, type: "HEALTH_DATA" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown type", () => {
    const result = createMemberConsentSchema.safeParse({ ...base, type: "MAGIC" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = createMemberConsentSchema.safeParse({ ...base, status: "MAGIC" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown channel", () => {
    const result = createMemberConsentSchema.safeParse({ ...base, channel: "CARRIER_PIGEON" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing textVersion", () => {
    const { textVersion, ...rest } = base;
    const result = createMemberConsentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an empty textVersion", () => {
    const result = createMemberConsentSchema.safeParse({ ...base, textVersion: "" });
    expect(result.success).toBe(false);
  });
});

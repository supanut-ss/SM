import { describe, expect, it } from "vitest";
import { createRoomSchema, updateRoomSchema } from "./room.js";

describe("createRoomSchema", () => {
  it("accepts a valid input", () => {
    const result = createRoomSchema.safeParse({ name: "ห้อง 1", roomTypeId: "rt_1", capacity: 2 });
    expect(result.success).toBe(true);
  });

  it("coerces a numeric string capacity (from a native <input type=number>)", () => {
    const result = createRoomSchema.safeParse({ name: "ห้อง 1", roomTypeId: "rt_1", capacity: "3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capacity).toBe(3);
  });

  it("rejects an empty name", () => {
    const result = createRoomSchema.safeParse({ name: "", roomTypeId: "rt_1", capacity: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing roomTypeId", () => {
    const result = createRoomSchema.safeParse({ name: "ห้อง 1", capacity: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects capacity zero", () => {
    const result = createRoomSchema.safeParse({ name: "ห้อง 1", roomTypeId: "rt_1", capacity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative capacity", () => {
    const result = createRoomSchema.safeParse({ name: "ห้อง 1", roomTypeId: "rt_1", capacity: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer capacity", () => {
    const result = createRoomSchema.safeParse({ name: "ห้อง 1", roomTypeId: "rt_1", capacity: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("updateRoomSchema", () => {
  it("accepts an empty object (no fields changed)", () => {
    const result = updateRoomSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive alone (the deactivate/reactivate path)", () => {
    const result = updateRoomSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("still enforces the capacity rule when capacity is present in a partial update", () => {
    const result = updateRoomSchema.safeParse({ capacity: 0 });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema } from "./users.js";

const base = {
  email: "test@lotusdesk.local",
  name: "John",
  password: "Password123!",
  roleKey: "staff",
};

describe("createUserSchema — ชื่อภาษาอังกฤษเท่านั้น (ADR-065)", () => {
  it("ยอมรับชื่อภาษาอังกฤษล้วน", () => {
    expect(createUserSchema.safeParse(base).success).toBe(true);
  });

  it("ยอมรับชื่อที่มีตัวเลข เว้นวรรค จุด ขีดกลาง อะพอสทรอฟี", () => {
    expect(createUserSchema.safeParse({ ...base, name: "Mary-Jane O'Brien 2" }).success).toBe(true);
  });

  it("ปฏิเสธชื่อภาษาไทย", () => {
    const result = createUserSchema.safeParse({ ...base, name: "สมชาย" });
    expect(result.success).toBe(false);
  });

  it("ปฏิเสธชื่อที่ขึ้นต้นด้วยตัวเลข", () => {
    const result = createUserSchema.safeParse({ ...base, name: "1John" });
    expect(result.success).toBe(false);
  });

  it("ปฏิเสธชื่อว่าง", () => {
    const result = createUserSchema.safeParse({ ...base, name: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema — ชื่อภาษาอังกฤษเท่านั้นเหมือน createUserSchema", () => {
  it("ยอมรับเมื่อไม่ส่งชื่อมา (optional)", () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("ปฏิเสธชื่อภาษาไทยตอนแก้ไขด้วย", () => {
    expect(updateUserSchema.safeParse({ name: "สมชาย" }).success).toBe(false);
  });
});

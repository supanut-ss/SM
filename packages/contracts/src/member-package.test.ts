import { describe, expect, it } from "vitest";
import {
  expireMemberPackageSchema,
  freezeMemberPackageSchema,
  purchaseMemberPackageSchema,
  refundMemberPackageSchema,
  transferMemberPackageSchema,
  useMemberPackageSchema,
} from "./member-package.js";

describe("purchaseMemberPackageSchema", () => {
  it("accepts a packageId", () => {
    expect(purchaseMemberPackageSchema.safeParse({ packageId: "pkg_1" }).success).toBe(true);
  });

  it("rejects an empty packageId", () => {
    expect(purchaseMemberPackageSchema.safeParse({ packageId: "" }).success).toBe(false);
  });
});

describe("useMemberPackageSchema", () => {
  it("accepts a valid amount", () => {
    const result = useMemberPackageSchema.safeParse({ amount: 1 });
    expect(result.success).toBe(true);
  });

  it("coerces numeric strings", () => {
    const result = useMemberPackageSchema.safeParse({ amount: "1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(1);
  });

  it("rejects amount 0", () => {
    expect(useMemberPackageSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(useMemberPackageSchema.safeParse({ amount: 1.5 }).success).toBe(false);
  });

  it("accepts an optional approvedByUserId and note", () => {
    const result = useMemberPackageSchema.safeParse({
      amount: 1,
      approvedByUserId: "user_1",
      note: "หมดอายุแล้ว ผู้จัดการอนุมัติ",
    });
    expect(result.success).toBe(true);
  });
});

describe("refundMemberPackageSchema", () => {
  it("accepts a ledgerEntryId with a note", () => {
    const result = refundMemberPackageSchema.safeParse({
      ledgerEntryId: "entry_1",
      note: "ยกเลิกบิล",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing note (reason required for refunds)", () => {
    expect(refundMemberPackageSchema.safeParse({ ledgerEntryId: "entry_1" }).success).toBe(false);
  });

  it("rejects an empty ledgerEntryId", () => {
    expect(refundMemberPackageSchema.safeParse({ ledgerEntryId: "", note: "x" }).success).toBe(false);
  });
});

describe("freezeMemberPackageSchema", () => {
  it("accepts a valid freeze request", () => {
    const result = freezeMemberPackageSchema.safeParse({ days: 14, approvedByUserId: "user_1" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing approvedByUserId (freeze always needs manager approval)", () => {
    expect(freezeMemberPackageSchema.safeParse({ days: 14 }).success).toBe(false);
  });

  it("rejects days 0", () => {
    expect(freezeMemberPackageSchema.safeParse({ days: 0, approvedByUserId: "user_1" }).success).toBe(
      false,
    );
  });
});

describe("transferMemberPackageSchema", () => {
  it("accepts a toMemberId", () => {
    expect(transferMemberPackageSchema.safeParse({ toMemberId: "member_2" }).success).toBe(true);
  });

  it("rejects an empty toMemberId", () => {
    expect(transferMemberPackageSchema.safeParse({ toMemberId: "" }).success).toBe(false);
  });
});

describe("expireMemberPackageSchema", () => {
  it("accepts approvedByUserId with a note", () => {
    const result = expireMemberPackageSchema.safeParse({
      approvedByUserId: "user_1",
      note: "ลูกค้าไม่ติดต่อกลับมา 1 ปี",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing approvedByUserId", () => {
    expect(expireMemberPackageSchema.safeParse({ note: "x" }).success).toBe(false);
  });

  it("rejects a missing note", () => {
    expect(expireMemberPackageSchema.safeParse({ approvedByUserId: "user_1" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  MAX_FREEZE_DAYS_PER_PACKAGE,
  validateExpire,
  validateFreeze,
  validateRefund,
  validateTransfer,
  validateUse,
} from "./index.js";

const NOW = new Date("2026-08-24T10:00:00Z");
const FUTURE = new Date("2026-12-31T00:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");

describe("validateUse", () => {
  it("accepts a valid SESSION_COUNT deduction within balance", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 5,
      amount: 1,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid VALUE deduction within balance", () => {
    const result = validateUse({
      packageType: "VALUE",
      currentBalance: 30000,
      amount: 30000,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects amount <= 0", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 5,
      amount: 0,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 5,
      amount: -1,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects insufficient SESSION_COUNT balance (the 1-left-2-concurrent-requests case)", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 0,
      amount: 1,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("ยอดคงเหลือ");
  });

  it("rejects insufficient VALUE balance", () => {
    const result = validateUse({
      packageType: "VALUE",
      currentBalance: 10000,
      amount: 30000,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("allows a balance-exhausting deduction that lands exactly at 0", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 1,
      amount: 1,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("never checks balance for UNLIMITED_DURATION even with a nominal 0 balance", () => {
    const result = validateUse({
      packageType: "UNLIMITED_DURATION",
      currentBalance: 0,
      amount: 1,
      now: NOW,
      expiresAt: FUTURE,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects use of an expired package without manager approval", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 5,
      amount: 1,
      now: NOW,
      expiresAt: PAST,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("หมดอายุ");
  });

  it("allows use of an expired package when a manager has approved", () => {
    const result = validateUse({
      packageType: "SESSION_COUNT",
      currentBalance: 5,
      amount: 1,
      now: NOW,
      expiresAt: PAST,
      approvedByUserId: "user_manager_1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects use of an expired UNLIMITED_DURATION package without approval", () => {
    const result = validateUse({
      packageType: "UNLIMITED_DURATION",
      currentBalance: 0,
      amount: 1,
      now: NOW,
      expiresAt: PAST,
      approvedByUserId: null,
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateRefund", () => {
  it("accepts refunding a USE entry on an ACTIVE package", () => {
    const result = validateRefund({ originalUseDelta: -1, memberPackageStatus: "ACTIVE" });
    expect(result.ok).toBe(true);
  });

  it("rejects refunding on a CLOSED package", () => {
    const result = validateRefund({ originalUseDelta: -1, memberPackageStatus: "CLOSED" });
    expect(result.ok).toBe(false);
  });

  it("rejects refunding an entry that was not a deduction (delta >= 0)", () => {
    const result = validateRefund({ originalUseDelta: 10, memberPackageStatus: "ACTIVE" });
    expect(result.ok).toBe(false);
  });

  it("rejects refunding a zero-delta entry", () => {
    const result = validateRefund({ originalUseDelta: 0, memberPackageStatus: "ACTIVE" });
    expect(result.ok).toBe(false);
  });
});

describe("validateFreeze", () => {
  it("accepts a valid freeze request within quota, approved", () => {
    const result = validateFreeze({
      requestedDays: 10,
      cumulativeFreezeDaysUsed: 0,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects freeze without manager approval — no exception ever", () => {
    const result = validateFreeze({
      requestedDays: 5,
      cumulativeFreezeDaysUsed: 0,
      approvedByUserId: null,
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects freeze on a CLOSED package", () => {
    const result = validateFreeze({
      requestedDays: 5,
      cumulativeFreezeDaysUsed: 0,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "CLOSED",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a zero-day freeze request", () => {
    const result = validateFreeze({
      requestedDays: 0,
      cumulativeFreezeDaysUsed: 0,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer freeze day count", () => {
    const result = validateFreeze({
      requestedDays: 2.5,
      cumulativeFreezeDaysUsed: 0,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(false);
  });

  it("allows freezing exactly up to the 30-day cap", () => {
    const result = validateFreeze({
      requestedDays: 30,
      cumulativeFreezeDaysUsed: 0,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(true);
    expect(MAX_FREEZE_DAYS_PER_PACKAGE).toBe(30);
  });

  it("rejects freezing 1 day past the 30-day cumulative cap", () => {
    const result = validateFreeze({
      requestedDays: 1,
      cumulativeFreezeDaysUsed: 30,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("30");
  });

  it("rejects a freeze request that would cross the cap even if it starts under it", () => {
    const result = validateFreeze({
      requestedDays: 10,
      cumulativeFreezeDaysUsed: 25,
      approvedByUserId: "user_manager_1",
      memberPackageStatus: "ACTIVE",
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateTransfer", () => {
  it("accepts a valid transfer of a SESSION_COUNT package with remaining balance", () => {
    const result = validateTransfer({
      fromMemberId: "member_1",
      toMemberId: "member_2",
      memberPackageStatus: "ACTIVE",
      currentBalance: 3,
      packageType: "SESSION_COUNT",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a transfer of an UNLIMITED_DURATION package even with a nominal 0 balance", () => {
    const result = validateTransfer({
      fromMemberId: "member_1",
      toMemberId: "member_2",
      memberPackageStatus: "ACTIVE",
      currentBalance: 0,
      packageType: "UNLIMITED_DURATION",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects transferring a CLOSED package", () => {
    const result = validateTransfer({
      fromMemberId: "member_1",
      toMemberId: "member_2",
      memberPackageStatus: "CLOSED",
      currentBalance: 3,
      packageType: "SESSION_COUNT",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects transferring to the same member", () => {
    const result = validateTransfer({
      fromMemberId: "member_1",
      toMemberId: "member_1",
      memberPackageStatus: "ACTIVE",
      currentBalance: 3,
      packageType: "SESSION_COUNT",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects transferring a SESSION_COUNT package with zero balance left", () => {
    const result = validateTransfer({
      fromMemberId: "member_1",
      toMemberId: "member_2",
      memberPackageStatus: "ACTIVE",
      currentBalance: 0,
      packageType: "SESSION_COUNT",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects transferring a VALUE package with negative balance (shouldn't happen, but must be defensive)", () => {
    const result = validateTransfer({
      fromMemberId: "member_1",
      toMemberId: "member_2",
      memberPackageStatus: "ACTIVE",
      currentBalance: -1,
      packageType: "VALUE",
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateExpire", () => {
  it("accepts closing an ACTIVE package with manager approval", () => {
    const result = validateExpire({ memberPackageStatus: "ACTIVE", approvedByUserId: "user_manager_1" });
    expect(result.ok).toBe(true);
  });

  it("rejects closing without manager approval", () => {
    const result = validateExpire({ memberPackageStatus: "ACTIVE", approvedByUserId: null });
    expect(result.ok).toBe(false);
  });

  it("rejects closing an already-CLOSED package", () => {
    const result = validateExpire({ memberPackageStatus: "CLOSED", approvedByUserId: "user_manager_1" });
    expect(result.ok).toBe(false);
  });
});

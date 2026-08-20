import { describe, expect, it } from "vitest";
import { applyBranchScope, BRANCH_SCOPED_MODELS } from "./branch-scope.extension";

describe("applyBranchScope", () => {
  it("injects branchId into where for a scoped model + read operation", () => {
    const result = applyBranchScope("Device", "findMany", { where: { isActive: true } }, "branch-a");

    expect(result.where).toEqual({ isActive: true, branchId: "branch-a" });
  });

  it("adds a where clause even when the original args had none", () => {
    const result = applyBranchScope("Device", "findFirst", {}, "branch-a");

    expect(result.where).toEqual({ branchId: "branch-a" });
  });

  it("branchId always wins even if the caller already set a different one (can't be spoofed)", () => {
    const result = applyBranchScope(
      "Device",
      "findMany",
      { where: { branchId: "some-other-branch" } },
      "branch-a",
    );

    expect((result.where as { branchId: string }).branchId).toBe("branch-a");
  });

  it("leaves args untouched for a model that isn't branch-scoped", () => {
    const original = { where: { key: "owner" } };
    const result = applyBranchScope("Role", "findMany", original, "branch-a");

    expect(result).toBe(original);
  });

  it("leaves args untouched for a write operation, even on a scoped model", () => {
    const original = { data: { label: "เครื่องใหม่", branchId: "whatever" } };
    const result = applyBranchScope("Device", "create", original, "branch-a");

    expect(result).toBe(original);
  });

  it.each([...BRANCH_SCOPED_MODELS])("scopes reads on %s", (model) => {
    const result = applyBranchScope(model, "findMany", {}, "branch-a");
    expect(result.where).toEqual({ branchId: "branch-a" });
  });
});

import { describe, expect, it } from "vitest";
import { buildAbility } from "./ability.factory";

describe("buildAbility", () => {
  it("grants exactly what's in the permission key list", () => {
    const ability = buildAbility(["branch:view", "booking:manage"]);

    expect(ability.can("view", "branch")).toBe(true);
    expect(ability.can("manage", "branch")).toBe(false);
    expect(ability.can("manage", "booking")).toBe(true);
  });

  it("manage implies view for the same resource", () => {
    const ability = buildAbility(["booking:manage"]);

    expect(ability.can("view", "booking")).toBe(true);
  });

  it("view does NOT imply manage", () => {
    const ability = buildAbility(["booking:view"]);

    expect(ability.can("manage", "booking")).toBe(false);
  });

  it("grants nothing for an empty permission list", () => {
    const ability = buildAbility([]);

    expect(ability.can("view", "branch")).toBe(false);
    expect(ability.can("manage", "branch")).toBe(false);
  });

  it("doesn't leak permission across unrelated resources", () => {
    const ability = buildAbility(["payroll:manage"]);

    expect(ability.can("view", "settings")).toBe(false);
  });
});

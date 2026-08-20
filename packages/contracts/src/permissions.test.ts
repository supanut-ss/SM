import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_PERMISSIONS } from "./permissions.js";

describe("permission catalog", () => {
  const allKeys = new Set(PERMISSIONS.map((p) => p.key));

  it("has no duplicate permission keys", () => {
    expect(allKeys.size).toBe(PERMISSIONS.length);
  });

  it.each(ROLE_DEFINITIONS)("$key: every granted permission key exists in the catalog", (role) => {
    for (const key of ROLE_PERMISSIONS[role.key]) {
      expect(allKeys.has(key)).toBe(true);
    }
  });

  it.each(ROLE_DEFINITIONS)("$key: has no duplicate permission grants", (role) => {
    const perms = ROLE_PERMISSIONS[role.key];
    expect(new Set(perms).size).toBe(perms.length);
  });

  it("owner has every permission in the catalog", () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(PERMISSIONS.length);
  });

  it("only owner can manage system settings", () => {
    expect(ROLE_PERMISSIONS.owner).toContain("settings:manage");
    expect(ROLE_PERMISSIONS.manager).not.toContain("settings:manage");
    expect(ROLE_PERMISSIONS.cashier).not.toContain("settings:manage");
    expect(ROLE_PERMISSIONS.staff).not.toContain("settings:manage");
  });

  it("manager can still view settings even without managing them", () => {
    expect(ROLE_PERMISSIONS.manager).toContain("settings:view");
  });

  it("staff cannot manage payroll (view own pay only)", () => {
    expect(ROLE_PERMISSIONS.staff).toContain("payroll:view");
    expect(ROLE_PERMISSIONS.staff).not.toContain("payroll:manage");
  });
});

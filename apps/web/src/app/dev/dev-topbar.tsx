"use client";

import { useState } from "react";
import { BranchSwitcher, Topbar, ThemeToggle, type BranchOption } from "@lotus-desk/ui";

const MOCK_BRANCHES: BranchOption[] = [
  { id: "main", name: "สาขาหลัก" },
  { id: "north", name: "สาขาเหนือ" },
];

export function DevTopbar() {
  const [branchId, setBranchId] = useState(MOCK_BRANCHES[0]!.id);

  return (
    <Topbar>
      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-semibold text-ink">
          Lotus Desk
        </span>
        <BranchSwitcher branches={MOCK_BRANCHES} value={branchId} onChange={setBranchId} />
      </div>
      <ThemeToggle />
    </Topbar>
  );
}

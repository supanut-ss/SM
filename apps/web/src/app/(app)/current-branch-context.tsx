"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MeBranch } from "@lotus-desk/contracts";

/**
 * สาขาที่กำลังเลือกอยู่ตอนนี้ (จาก BranchSwitcher ใน AuthenticatedShell) — หน้าที่ดึงข้อมูลตามสาขา
 * (T2.1 เป็นต้นไป) ใช้ useCurrentBranch() แทนการดัก branchId เองจาก useMe() ตรง ๆ
 */
const CurrentBranchContext = createContext<MeBranch | null>(null);

export function CurrentBranchProvider({
  branch,
  children,
}: {
  branch: MeBranch | null;
  children: ReactNode;
}) {
  return <CurrentBranchContext.Provider value={branch}>{children}</CurrentBranchContext.Provider>;
}

export function useCurrentBranch(): MeBranch | null {
  return useContext(CurrentBranchContext);
}

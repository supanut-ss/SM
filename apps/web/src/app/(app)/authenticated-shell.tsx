"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, BranchSwitcher, Sidebar, SidebarLink, ThemeToggle, Topbar } from "@lotus-desk/ui";
import { useMe } from "../../lib/use-me";
import { ApiError } from "../../lib/api-client";
import { NAV_ITEMS } from "./nav-items";
import { hasPermission } from "./permissions";
import { LogoutButton } from "./logout-button";
import { CurrentBranchProvider } from "./current-branch-context";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError, error } = useMe();
  const [branchId, setBranchId] = useState<string | null>(null);

  const branches = me?.branches ?? [];
  // ถ้ายังไม่เคยเลือกสาขาเอง (branchId เป็น null) ให้ตกไปที่สาขาแรกโดยไม่ต้องมี effect แยก sync state
  const currentBranch = branches.find((b) => b.branchId === branchId) ?? branches[0];

  useEffect(() => {
    // middleware เช็คแค่ "มี cookie ไหม" — ถ้า cookie หมดอายุ/ไม่ valid API จะตอบ 401 ตรงนี้
    if (isError && error instanceof ApiError && error.status === 401) {
      router.push("/login");
    }
  }, [isError, error, router]);

  const visibleNavItems = useMemo(() => {
    const permissions = currentBranch?.permissions ?? [];
    return NAV_ITEMS.filter(
      (item) => !item.require || hasPermission(permissions, item.require.action, item.require.resource),
    );
  }, [currentBranch]);

  if (isLoading || !me) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-muted">กำลังโหลด...</div>;
  }

  return (
    <AppShell
      topbar={
        <Topbar>
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-semibold text-ink">Lotus Desk</span>
            {branches.length > 0 && currentBranch && (
              <BranchSwitcher
                branches={branches.map((b) => ({ id: b.branchId, name: b.branchName }))}
                value={currentBranch.branchId}
                onChange={setBranchId}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">
              {me.name} ({currentBranch?.roleName ?? "-"})
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </Topbar>
      }
      sidebar={
        <Sidebar>
          {visibleNavItems.map((item) => (
            <SidebarLink key={item.href} as={Link} href={item.href} active={pathname === item.href}>
              {item.label}
            </SidebarLink>
          ))}
        </Sidebar>
      }
    >
      <CurrentBranchProvider branch={currentBranch ?? null}>{children}</CurrentBranchProvider>
    </AppShell>
  );
}

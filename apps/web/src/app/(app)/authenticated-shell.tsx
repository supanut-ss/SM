"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  BottomTabBar,
  BranchSwitcher,
  Sheet,
  Sidebar,
  SidebarGroup,
  SidebarLink,
  ThemeToggle,
  Topbar,
  cn,
} from "@lotus-desk/ui";
import { useMe } from "../../lib/use-me";
import { ApiError } from "../../lib/api-client";
import { CommandPalette } from "./command-palette";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-items";
import { hasPermission } from "./permissions";
import { LogoutButton } from "./logout-button";
import { CurrentBranchProvider } from "./current-branch-context";

const SIDEBAR_COLLAPSED_KEY = "lotus-desk-sidebar-collapsed";
const SIDEBAR_COLLAPSED_EVENT = "lotus-desk-sidebar-collapsed-change";

// 4 เมนูหลักบน bottom tab bar (ดู docs/DESIGN.md §9.2) — เลือกจาก 6 เมนู Basic Package (ADR-050)
// เพราะเป็น 4 อย่างที่พนักงานต้อนรับสลับไปมาบ่อยที่สุดระหว่างวัน ที่เหลือ (พนักงาน/บริการ/คอร์ส) อยู่ใน
// "เพิ่มเติม" เรียงตามลำดับที่ต้องการให้ปรากฏบนแถบ ไม่ใช่ลำดับใน NAV_ITEMS
const BOTTOM_TAB_HREFS = ["/", "/board", "/billing", "/members"];

// จำสถานะย่อเมนูไว้ต่อเครื่อง — ใช้ useSyncExternalStore แพทเทิร์นเดียวกับ ThemeToggle
// (packages/ui/src/components/theme-toggle.tsx) แทน useEffect+setState เพราะ setState synchronous ใน
// effect โดน react-hooks/set-state-in-effect และทำให้ render ซ้อนโดยไม่จำเป็น
function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  } catch {
    // เก็บค่าไม่ได้ก็ไม่เป็นไร (private mode เข้มงวด) — แค่ไม่จำข้ามเซสชัน
  }
  window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
}

function subscribeSidebarCollapsed(callback: () => void) {
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, callback);
  return () => window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, callback);
}

function getServerSnapshotSidebarCollapsed(): boolean {
  return false;
}

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError, error } = useMe();
  const [branchId, setBranchId] = useState<string | null>(null);
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readSidebarCollapsed,
    getServerSnapshotSidebarCollapsed,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // ปิดลิ้นชักเมนูมือถือ/sheet "เพิ่มเติม" ทันทีที่เปลี่ยนหน้า — ปรับ state ระหว่าง render (ดูเหตุผล
  // เดียวกับ command-palette.tsx) แทน useEffect([pathname]) เพื่อกัน react-hooks/set-state-in-effect
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileNavOpen(false);
    setMoreNavOpen(false);
    setAccountMenuOpen(false);
  }

  const branches = me?.branches ?? [];
  // ถ้ายังไม่เคยเลือกสาขาเอง (branchId เป็น null) ให้ตกไปที่สาขาแรกโดยไม่ต้องมี effect แยก sync state
  const currentBranch = branches.find((b) => b.branchId === branchId) ?? branches[0];

  useEffect(() => {
    // middleware เช็คแค่ "มี cookie ไหม" — ถ้า cookie หมดอายุ/ไม่ valid API จะตอบ 401 ตรงนี้
    if (isError && error instanceof ApiError && error.status === 401) {
      router.push("/login");
    }
  }, [isError, error, router]);

  function toggleSidebarCollapsed() {
    writeSidebarCollapsed(!readSidebarCollapsed());
  }

  const visibleNavItems = useMemo(() => {
    const permissions = currentBranch?.permissions ?? [];
    return NAV_ITEMS.filter(
      (item) => !item.require || hasPermission(permissions, item.require.action, item.require.resource),
    );
  }, [currentBranch]);

  const groupedNavItems = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({ group, items: visibleNavItems.filter((item) => item.group === group) })).filter(
        (g) => g.items.length > 0,
      ),
    [visibleNavItems],
  );

  // แถบเมนูล่าง (มือถือ, < md): 4 เมนูหลักตามสิทธิ์จริง — ถ้าบทบาทไม่มีสิทธิ์เห็นเมนูใดใน 4 อย่างนี้
  // (เช่น พนักงานบริการไม่เห็น "บิล/แคชเชียร์") ก็แค่หายไปจากแถบ ไม่เติมเมนูอื่นมาแทนที่ตำแหน่ง
  const bottomTabItems = useMemo(
    () =>
      BOTTOM_TAB_HREFS.map((href) => visibleNavItems.find((item) => item.href === href)).filter(
        (item): item is (typeof visibleNavItems)[number] => item !== undefined,
      ),
    [visibleNavItems],
  );
  const moreNavItems = useMemo(
    () => visibleNavItems.filter((item) => !BOTTOM_TAB_HREFS.includes(item.href)),
    [visibleNavItems],
  );
  const isMoreActive = moreNavItems.some((item) => item.href === pathname);

  if (isLoading || !me) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-muted">กำลังโหลด...</div>;
  }

  return (
    <>
      <AppShell
        sidebarCollapsed={sidebarCollapsed}
        mobileNavOpen={mobileNavOpen}
        onMobileNavOpen={() => setMobileNavOpen(true)}
        onMobileNavClose={() => setMobileNavOpen(false)}
        bottomBar={
          <BottomTabBar
            as={Link}
            items={bottomTabItems.map((item) => ({
              href: item.href,
              label: item.label,
              icon: <item.icon />,
              active: pathname === item.href,
            }))}
            moreActive={isMoreActive}
            onMoreClick={() => {
              setAccountMenuOpen(false);
              setMoreNavOpen(true);
            }}
          />
        }
        topbar={
          <Topbar>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden md:gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-celadon-solid text-white md:hidden"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
                  <path d="M12 21c-4-2.2-7-5.6-7-10a7 7 0 0 1 14 0c0 4.4-3 7.8-7 10Z" />
                  <path d="M12 11v10" />
                </svg>
              </span>
              {branches.length > 0 && currentBranch && (
                <BranchSwitcher
                  branches={branches.map((b) => ({ id: b.branchId, name: b.branchName }))}
                  value={currentBranch.branchId}
                  onChange={setBranchId}
                  className="min-w-0 flex-1 md:w-44 md:flex-none"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setMoreNavOpen(false);
                  setAccountMenuOpen(false);
                  setCmdkOpen(true);
                }}
                className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-DEFAULT border border-line px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:border-line-strong hover:text-ink-muted lg:flex"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5 shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4-4" />
                </svg>
                ค้นหา หรือไปที่หน้า...
                <span className="ml-1 rounded border border-line-strong bg-surface-sunk px-1.5 py-0.5 font-data text-[10px]">
                  ⌘K
                </span>
              </button>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <span className="hidden max-w-28 truncate text-sm text-ink-muted lg:inline">
                {me.name} ({currentBranch?.roleName ?? "-"})
              </span>
              <ThemeToggle />
              <LogoutButton />
            </div>
            <button
              type="button"
              onClick={() => {
                setMoreNavOpen(false);
                setAccountMenuOpen(true);
              }}
              aria-label="เปิดเมนูบัญชี"
              aria-expanded={accountMenuOpen}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-DEFAULT text-ink-muted hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
              </svg>
            </button>
          </Topbar>
        }
        sidebar={
          <Sidebar>
            <div className={cn("flex items-center gap-2.5 px-1 pb-1", sidebarCollapsed && "justify-center px-0")}>
              {/* unoptimized: Next image optimizer (ไม่มี sharp ในโปรเจกต์) แปลง PNG นี้ไม่ผ่าน —
                  object-contain เพราะ crop ไม่ใช่สี่เหลี่ยมจัตุรัสเป๊ะ (1177x963) กัน squish */}
              <Image
                src="/logo-icon.png"
                alt="Sabaizy"
                width={200}
                height={163}
                className="size-7 shrink-0 object-contain"
                unoptimized
              />
              {!sidebarCollapsed && (
                <span className="font-display text-[15.5px] font-semibold text-ink">Sabaizy</span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-5">
              {groupedNavItems.map(({ group, items }) => (
                <SidebarGroup key={group} label={group} collapsed={sidebarCollapsed}>
                  {items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      as={Link}
                      href={item.href}
                      active={pathname === item.href}
                      collapsed={sidebarCollapsed}
                      icon={<item.icon />}
                    >
                      {item.label}
                    </SidebarLink>
                  ))}
                </SidebarGroup>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-pressed={sidebarCollapsed}
              className={cn(
                "hidden items-center gap-2 rounded-DEFAULT border border-line px-2.5 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink md:flex",
                sidebarCollapsed && "justify-center",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("h-[15px] w-[15px] shrink-0 transition-transform duration-200", sidebarCollapsed && "rotate-180")}
              >
                <path d="M9 4v16M4 4h16v16H4z" />
                <path d="m10.5 9-2.5 3 2.5 3" />
              </svg>
              {!sidebarCollapsed && "ย่อเมนู"}
            </button>
          </Sidebar>
        }
      >
        <CurrentBranchProvider branch={currentBranch ?? null}>{children}</CurrentBranchProvider>
      </AppShell>

      <Sheet open={moreNavOpen} onClose={() => setMoreNavOpen(false)} title="เมนูเพิ่มเติม">
        <nav className="flex flex-col gap-1" aria-label="เมนูเพิ่มเติม">
          {moreNavItems.map((item) => (
            <SidebarLink
              key={item.href}
              as={Link}
              href={item.href}
              active={pathname === item.href}
              icon={<item.icon />}
              onClick={() => setMoreNavOpen(false)}
            >
              {item.label}
            </SidebarLink>
          ))}
        </nav>
      </Sheet>

      <Sheet open={accountMenuOpen} onClose={() => setAccountMenuOpen(false)} title="บัญชีและการแสดงผล">
        <div className="grid gap-5">
          <div className="rounded-DEFAULT border border-line bg-surface-sunk px-4 py-3">
            <p className="font-medium text-ink">{me.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{currentBranch?.roleName ?? "ไม่ระบุบทบาท"}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </Sheet>

      <CommandPalette
        open={cmdkOpen}
        onOpen={() => {
          setMoreNavOpen(false);
          setAccountMenuOpen(false);
          setCmdkOpen(true);
        }}
        onClose={() => setCmdkOpen(false)}
        items={visibleNavItems}
        onNavigate={(href) => {
          setCmdkOpen(false);
          router.push(href);
        }}
      />
    </>
  );
}

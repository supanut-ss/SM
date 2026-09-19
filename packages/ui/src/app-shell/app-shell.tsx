import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  /** true = เมนูซ้ายย่อเหลือแถบไอคอน 72px (เฉพาะจอ md ขึ้นไป — ดู docs/decisions.md ADR-047) */
  sidebarCollapsed?: boolean;
  /** ลิ้นชักเมนูสำหรับจอแคบกว่า md — ใช้เฉพาะตอนไม่มี `bottomBar` (ต่ำกว่านี้เดิมกดเมนูไม่ได้เลยเพราะ
   * sidebar ซ่อนล้วน ๆ) หน้าที่มี `bottomBar` (ดู docs/DESIGN.md §9.2) ไม่ใช้ลิ้นชักนี้อีกต่อไป —
   * bottom tab bar แทนที่ทางเข้าเมนูบนจอแคบทั้งหมด */
  mobileNavOpen?: boolean;
  onMobileNavOpen?: () => void;
  onMobileNavClose?: () => void;
  /** แถบเมนูล่างสำหรับจอ < md (BottomTabBar) — ใส่แล้ว AppShell จะซ่อนปุ่ม hamburger และลิ้นชักเดิม
   * บนจอแคบไปเลย เพราะ bottom bar ทำหน้าที่นำทางแทน (ดู docs/DESIGN.md §9.2, T10.2) */
  bottomBar?: ReactNode;
}

/** โครงหน้าหลัก: Sidebar 240px (ย่อได้ 72px) ซ้าย + Topbar 56px บน + เนื้อหา (ดู docs/DESIGN.md §5) */
export function AppShell({
  sidebar,
  topbar,
  children,
  sidebarCollapsed = false,
  mobileNavOpen = false,
  onMobileNavOpen,
  onMobileNavClose,
  bottomBar,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-paper md:flex-row",
        // มี bottomBar: ต้องล็อกความสูงเท่า viewport บนจอแคบ (ไม่ใช่แค่ min-height) ให้ topbar/bottomBar
        // ลอยนิ่งเสมอ แล้วให้ main ข้างในเลื่อนเองแทน — ไม่งั้น flex item ที่มีแค่ min-height จะโตตามเนื้อหา
        // จนดันแถบล่างหลุดจอ (บั๊กที่เจอจริงตอนต่อ T10.2 เข้า /board) จอกว้าง (md+) กลับไปใช้พฤติกรรมเดิม
        // คือให้หน้าเลื่อนทั้งหน้าตามปกติเสมอ ไม่ว่าจะมี bottomBar หรือไม่
        bottomBar ? "h-dvh overflow-hidden md:h-auto md:min-h-dvh md:overflow-visible" : "min-h-dvh",
      )}
    >
      {!bottomBar && mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/35 md:hidden"
          onClick={onMobileNavClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "z-40 w-60 shrink-0 border-r border-line bg-surface",
          "md:sticky md:inset-y-auto md:top-0 md:h-dvh md:translate-x-0",
          bottomBar
            ? "hidden md:block"
            : cn(
                "fixed inset-y-0 left-0 transition-transform duration-200 ease-out",
                mobileNavOpen ? "translate-x-0" : "-translate-x-full",
              ),
          sidebarCollapsed ? "md:w-[72px]" : "md:w-60",
        )}
      >
        {sidebar}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
          {!bottomBar && (
            <button
              type="button"
              onClick={onMobileNavOpen}
              aria-label="เปิดเมนู"
              className="-ml-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-DEFAULT text-ink hover:bg-surface-sunk md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          )}
          <div className="min-w-0 flex-1">{topbar}</div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
        {bottomBar}
      </div>
    </div>
  );
}

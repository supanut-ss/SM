import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  /** true = เมนูซ้ายย่อเหลือแถบไอคอน 72px (เฉพาะจอ md ขึ้นไป — ดู docs/decisions.md ADR-047) */
  sidebarCollapsed?: boolean;
  /** ลิ้นชักเมนูสำหรับจอแคบกว่า md (ต่ำกว่านี้เดิมกดเมนูไม่ได้เลยเพราะ sidebar ซ่อนล้วน ๆ) */
  mobileNavOpen?: boolean;
  onMobileNavOpen?: () => void;
  onMobileNavClose?: () => void;
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
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-paper">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/35 md:hidden"
          onClick={onMobileNavClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-line bg-surface transition-transform duration-200 ease-out",
          "md:sticky md:inset-y-auto md:top-0 md:h-dvh md:translate-x-0 md:transition-[width] md:duration-200",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "md:w-[72px]" : "md:w-60",
        )}
      >
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
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
          <div className="min-w-0 flex-1">{topbar}</div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

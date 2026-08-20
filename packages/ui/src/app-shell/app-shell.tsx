import type { ReactNode } from "react";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

/** โครงหน้าหลัก: Sidebar 240px ซ้าย + Topbar 56px บน + เนื้อหา (ดู docs/DESIGN.md §3.5) */
export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-paper">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:block">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-line bg-surface px-4">
          {topbar}
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

import type { AnchorHTMLAttributes, ElementType, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * แถบเมนูล่างสำหรับจอ < md (ดู docs/DESIGN.md §9.2) — แทนที่ hamburger + drawer เดิมของ AppShell
 * บนจอแคบ แสดง 4 เมนูหลัก + ปุ่ม "เพิ่มเติม" เสมอ (ปุ่มที่ 5 เปิด Sheet รายการเมนูที่เหลือ ผู้เรียกเป็น
 * คนควบคุม state เปิด/ปิดเอง — component นี้แค่วาดแถบกับปุ่ม)
 *
 * padding ล่างกัน gesture bar ของมือถือรุ่นใหม่ (safe-area-inset-bottom) — ใช้ inline style เพราะ
 * Tailwind ไม่มี utility สำหรับ env() ตรงๆ โดยไม่ตั้ง plugin เพิ่ม (CLAUDE.md ห้ามเพิ่ม dependency ใหม่
 * โดยไม่ถาม)
 */
export interface BottomTabItem {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
}

export interface BottomTabBarProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> {
  items: BottomTabItem[];
  /** ปกติเป็น "a" — ส่ง next/link's Link เข้ามาแทนได้เพื่อใช้ client-side navigation (เหมือน SidebarLink) */
  as?: ElementType;
  moreLabel?: string;
  moreActive?: boolean;
  onMoreClick: () => void;
}

export function BottomTabBar({
  items,
  as: Component = "a",
  moreLabel = "เพิ่มเติม",
  moreActive = false,
  onMoreClick,
  ...anchorProps
}: BottomTabBarProps) {
  return (
    <nav
      aria-label="เมนูหลัก"
      className="flex shrink-0 items-stretch border-t border-line bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {items.map((item) => (
        <Component
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-celadon focus-visible:-outline-offset-2",
            item.active ? "text-celadon" : "text-ink-muted",
          )}
          {...anchorProps}
        >
          <span className="[&>svg]:h-[22px] [&>svg]:w-[22px]">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </Component>
      ))}
      <button
        type="button"
        onClick={onMoreClick}
        aria-current={moreActive ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-celadon focus-visible:-outline-offset-2",
          moreActive ? "text-celadon" : "text-ink-muted",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-[22px] w-[22px]">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="truncate">{moreLabel}</span>
      </button>
    </nav>
  );
}

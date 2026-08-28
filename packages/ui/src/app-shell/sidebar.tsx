import type { AnchorHTMLAttributes, ElementType, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-3" aria-label="เมนูหลัก">
      {children}
    </nav>
  );
}

export interface SidebarGroupProps {
  label: string;
  /** true = โหมดย่อแถบไอคอน ซ่อนหัวข้อกลุ่ม (ดู docs/decisions.md ADR-047) */
  collapsed?: boolean;
  children: ReactNode;
}

export function SidebarGroup({ label, collapsed, children }: SidebarGroupProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && (
        <span className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

export interface SidebarLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  /** โหมดย่อแถบไอคอน — ซ่อน label เหลือแค่ไอคอน + title tooltip */
  collapsed?: boolean;
  icon?: ReactNode;
  /** ปกติเป็น "a" — ส่ง next/link's Link เข้ามาแทนได้เพื่อใช้ client-side navigation */
  as?: ElementType;
}

export function SidebarLink({
  active,
  collapsed,
  icon,
  as: Component = "a",
  className,
  children,
  title,
  ...props
}: SidebarLinkProps) {
  const fallbackTitle = typeof children === "string" ? children : undefined;
  return (
    <Component
      aria-current={active ? "page" : undefined}
      title={collapsed ? (title ?? fallbackTitle) : title}
      className={cn(
        "flex items-center gap-2.5 rounded-DEFAULT border-l-[3px] border-transparent px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors duration-150",
        "hover:bg-surface-sunk hover:text-ink",
        active && "border-celadon-solid bg-celadon-tint text-celadon-hover",
        collapsed && "justify-center px-2",
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
      {!collapsed && <span className="truncate">{children}</span>}
    </Component>
  );
}

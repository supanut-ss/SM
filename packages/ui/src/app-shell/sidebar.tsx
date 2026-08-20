import type { AnchorHTMLAttributes, ElementType, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="เมนูหลัก">
      {children}
    </nav>
  );
}

export interface SidebarLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  /** ปกติเป็น "a" — ส่ง next/link's Link เข้ามาแทนได้เพื่อใช้ client-side navigation */
  as?: ElementType;
}

export function SidebarLink({ active, as: Component = "a", className, ...props }: SidebarLinkProps) {
  return (
    <Component
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-DEFAULT px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-150",
        "hover:bg-surface-sunk hover:text-ink",
        active && "bg-celadon-tint text-celadon-hover",
        className,
      )}
      {...props}
    />
  );
}

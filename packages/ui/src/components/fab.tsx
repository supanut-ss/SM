import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Floating Action Button — เฉพาะหน้าที่มี action หลักเดียวชัดเจน (สมาชิก/พนักงาน/บริการ/ห้อง/คอร์ส)
 * แสดงเฉพาะจอ < md แทนปุ่ม "+" บนสุดเดิม เพราะปุ่มบนสุดอยู่ไกลนิ้วโป้งเกินไปตอนถือมือถือมือเดียว
 * (ดู docs/DESIGN.md §9.3) วางเหนือ bottom tab bar 16px เสมอ — ถ้าหน้าไหนไม่มี bottom tab bar
 * (ไม่ได้ใส่ bottomBar ให้ AppShell) ให้ปรับระยะ bottom เองผ่าน className
 */
export interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
}

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-[22px] w-[22px]">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function Fab({ icon = DEFAULT_ICON, className, ...props }: FabProps) {
  return (
    <button
      type="button"
      className={cn(
        "fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] right-4 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-celadon-solid text-white shadow-pop md:hidden",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-celadon focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

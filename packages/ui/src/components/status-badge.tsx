import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

// สถานะนัดทั้ง 7 + สีที่ใช้ร่วมกันทั้งระบบ — ห้ามคิดสีใหม่รายหน้า (ดู docs/DESIGN.md §3.3)
export const APPOINTMENT_STATUSES = [
  "booked",
  "confirmed",
  "checked_in",
  "in_service",
  "completed",
  "no_show",
  "cancelled",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "จองไว้",
  confirmed: "ยืนยันแล้ว",
  checked_in: "เช็คอินแล้ว",
  in_service: "กำลังบริการ",
  completed: "เสร็จแล้ว",
  no_show: "ไม่มา",
  cancelled: "ยกเลิก",
};

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  booked: "border border-dashed border-indigo bg-indigo-tint text-indigo",
  confirmed: "border-l-[3px] border-indigo bg-indigo-tint text-indigo",
  checked_in: "border-l-[3px] border-brass bg-brass-tint text-brass",
  in_service: "bg-celadon-solid text-white",
  completed: "bg-surface-sunk text-ink-faint",
  no_show: "bg-rose-tint text-rose line-through decoration-rose",
  cancelled: "border border-line text-ink-faint line-through",
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: AppointmentStatus;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-DEFAULT px-2.5 py-1 text-xs font-medium",
        STATUS_STYLE[status],
        className,
      )}
      {...props}
    >
      {status === "in_service" && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse"
        />
      )}
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

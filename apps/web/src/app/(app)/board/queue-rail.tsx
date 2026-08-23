"use client";

import { cn } from "@lotus-desk/ui";
import type { AppointmentItem, StaffQueueEntry } from "../../../lib/api-client";

/**
 * รางคิวหมุนริมซ้าย (T4.5) — แสดงลำดับคิว พนักงานที่กำลังบริการอยู่ (มีนัดสถานะ IN_SERVICE) แสดงจางลง
 * ยังไม่มี "คลิกเพื่อจองด่วน" ที่นี่ (จะมาพร้อม flow จองจริงใน T4.6 — ตอนนี้คลิกแค่เลื่อนกระดานไปแถวนั้น)
 */
export function QueueRail({
  queue,
  items,
  onSelectStaff,
}: {
  queue: StaffQueueEntry[];
  items: AppointmentItem[];
  onSelectStaff?: (staffId: string) => void;
}) {
  const workingStaffIds = new Set(
    items.filter((i) => i.status === "IN_SERVICE").map((i) => i.staffId),
  );
  const sorted = [...queue].sort((a, b) => a.position - b.position);

  return (
    <div className="flex w-16 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface-sunk p-1">
      <span className="mb-1 text-center text-[10px] font-medium text-ink-muted">คิวหมุน</span>
      {sorted.length === 0 && (
        <span className="px-1 text-center text-[10px] text-ink-faint">ยังไม่มีใครเข้าคิว</span>
      )}
      {sorted.map((entry, i) => {
        const working = workingStaffIds.has(entry.staffId);
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelectStaff?.(entry.staffId)}
            title={working ? `${entry.staff.name} — กำลังบริการอยู่` : entry.staff.name}
            className={cn(
              "flex flex-col items-center rounded-DEFAULT border border-line bg-surface px-1 py-1.5 text-[10px] hover:border-celadon",
              working && "opacity-40",
            )}
          >
            <span className="font-data tabular-nums text-ink-faint">{i + 1}</span>
            <span className="line-clamp-2 max-w-full text-center leading-tight text-ink">
              {entry.staff.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

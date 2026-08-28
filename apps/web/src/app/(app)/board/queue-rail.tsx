"use client";

import { cn } from "@lotus-desk/ui";
import type { AppointmentItem, StaffProfile, StaffQueueEntry } from "../../../lib/api-client";

/**
 * รางคิวหมุนริมซ้าย (T4.5) — แสดงลำดับคิว พนักงานที่กำลังบริการอยู่ (มีนัดสถานะ IN_SERVICE) แสดงจางลง
 * ยังไม่มี "คลิกเพื่อจองด่วน" ที่นี่ (จะมาพร้อม flow จองจริงใน T4.6 — ตอนนี้คลิกแค่เลื่อนกระดานไปแถวนั้น)
 *
 * ส่วน "ยังไม่เข้าคิว" ด้านล่าง (T4.4 ที่หายไป — ดู docs/decisions.md ADR-049) — เดิมพนักงานที่ยังไม่มี
 * นัดของวันนั้นเลยไม่มีทางเข้าคิวได้เอง เพราะระบบเข้าคิวให้อัตโนมัติแค่ตอนนัด "แรก" จบ/ยกเลิก ไม่ใช่ตอนเริ่ม
 * วัน — เพิ่มปุ่มให้กดเข้าคิวเองได้ตรงนี้แทน (ใช้ endpoint POST /staff-queue/join ที่มีอยู่แล้วตั้งแต่ T4.4)
 */
export function QueueRail({
  queue,
  items,
  onSelectStaff,
  notInQueue = [],
  onJoinQueue,
  isJoining = false,
}: {
  queue: StaffQueueEntry[];
  items: AppointmentItem[];
  onSelectStaff?: (staffId: string) => void;
  notInQueue?: StaffProfile[];
  onJoinQueue?: (staffId: string) => void;
  isJoining?: boolean;
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

      {notInQueue.length > 0 && (
        <>
          <span className="mb-1 mt-2 border-t border-line-strong pt-2 text-center text-[10px] font-medium text-ink-muted">
            ยังไม่เข้าคิว
          </span>
          {notInQueue.map((staff) => (
            <button
              key={staff.id}
              type="button"
              disabled={isJoining}
              onClick={() => onJoinQueue?.(staff.id)}
              title={`ให้ ${staff.name} เข้าคิว`}
              className="flex flex-col items-center gap-0.5 rounded-DEFAULT border border-dashed border-line-strong bg-surface px-1 py-1.5 text-[10px] text-ink-faint hover:border-celadon hover:text-celadon-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true" className="text-xs leading-none">
                +
              </span>
              <span className="line-clamp-2 max-w-full text-center leading-tight">{staff.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

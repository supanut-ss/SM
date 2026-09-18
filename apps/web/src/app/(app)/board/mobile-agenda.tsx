"use client";

import { useMemo, useState } from "react";
import { cn } from "@lotus-desk/ui";
import { APPOINTMENT_STATUS_LABEL, ASSIGN_TYPE_LABEL } from "@lotus-desk/contracts";
import type { AppointmentItem, StaffQueueEntry } from "../../../lib/api-client";
import { STATUS_STYLE } from "./status-colors";
import type { BoardRow } from "./lane-board";

/**
 * มุมมอง "รายคน" ของกระดานคิวสำหรับจอ < md (T10.5, ดู docs/DESIGN.md §9.4) — แทน Lane Board grid
 * เวลา×แถวที่ต้องเลื่อนแนวนอนบนจอกว้างเท่านั้น เลือกแถว (พนักงาน/ห้องแล้วแต่ viewMode) จาก chip เลื่อน
 * แนวนอนบนสุด แล้วแสดง timeline ของแถวนั้นแนวตั้งอย่างเดียว — ไม่มี drag-and-drop (นิ้วลากบนจอเล็ก
 * แม่นยำไม่พอกับ time slot ละเอียด ตามที่ระบุไว้ใน docs/DESIGN.md §9.4) ย้ายเวลา/คนทำผ่าน
 * AppointmentDetailSheet ที่มีอยู่แล้วแทน
 */
export function MobileAgenda({
  rows,
  items,
  rowKeyOf,
  queue,
  onOpenDetail,
}: {
  rows: BoardRow[];
  items: AppointmentItem[];
  rowKeyOf: (item: AppointmentItem) => string;
  /** ส่งมาเฉพาะตอน viewMode === "staff" — มุมมองห้องไม่มีคิวหมุน */
  queue?: StaffQueueEntry[];
  onOpenDetail: (item: AppointmentItem) => void;
}) {
  const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? null);
  const activeRowId = rows.some((r) => r.id === selectedRowId) ? selectedRowId : (rows[0]?.id ?? null);

  const itemsByRow = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();
    for (const item of items) {
      if (item.status === "CANCELLED") continue; // ไม่แสดงบนกระดาน (ดู docs/DESIGN.md §3.3)
      const key = rowKeyOf(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return map;
  }, [items, rowKeyOf]);

  const workingRowIds = new Set(
    items.filter((i) => i.status === "IN_SERVICE").map((i) => rowKeyOf(i)),
  );

  const activeItems = activeRowId ? (itemsByRow.get(activeRowId) ?? []) : [];
  const sortedQueue = queue ? [...queue].sort((a, b) => a.position - b.position) : null;

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* chip เลือกแถว — เลื่อนแนวนอนได้ ไม่ทำให้ทั้งหน้ากว้างเกินจอ */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-surface p-3">
        {rows.map((row) => {
          const active = row.id === activeRowId;
          const working = workingRowIds.has(row.id);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedRowId(row.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 rounded-DEFAULT px-3.5 py-2 text-xs",
                active ? "bg-celadon-solid text-white" : "bg-surface-sunk text-ink",
              )}
            >
              <span className="font-medium">{row.label}</span>
              <span className={cn("text-[10.5px]", active ? "text-white/85" : "text-ink-faint")}>
                {working ? "กำลังบริการ" : row.sublabel ?? "ว่าง"}
              </span>
            </button>
          );
        })}
      </div>

      {/* รางคิวหมุน — เฉพาะมุมมองพนักงาน */}
      {sortedQueue && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line bg-surface px-3 py-2">
          <span className="shrink-0 text-[11px] text-ink-faint">คิวหมุน:</span>
          {sortedQueue.length === 0 ? (
            <span className="text-[11px] text-ink-faint">ยังไม่มีใครเข้าคิว</span>
          ) : (
            sortedQueue.map((entry, i) => (
              <span
                key={entry.id}
                className={cn(
                  "shrink-0 rounded-DEFAULT px-2 py-0.5 font-data text-xs",
                  entry.staffId === activeRowId
                    ? "bg-brass-tint text-brass"
                    : "bg-surface-sunk text-ink-muted",
                )}
              >
                {i + 1} {entry.staff.name}
              </span>
            ))
          )}
        </div>
      )}

      {/* timeline แนวตั้งของแถวที่เลือก */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeItems.length === 0 && (
          <p className="pt-6 text-center text-sm text-ink-muted">ยังไม่มีนัดของ{rows.find((r) => r.id === activeRowId)?.label ?? "คนนี้"}วันนี้</p>
        )}
        <div className="flex flex-col gap-3">
          {activeItems.map((item) => {
            const style = STATUS_STYLE[item.status];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenDetail(item)}
                className={cn(
                  "relative rounded-DEFAULT p-3 text-left text-sm",
                  style.block,
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-celadon focus-visible:outline-offset-2",
                )}
              >
                {item.assignType === "CUSTOMER_REQUEST" && (
                  <span
                    aria-hidden
                    title={ASSIGN_TYPE_LABEL.CUSTOMER_REQUEST}
                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brass"
                  />
                )}
                <div className="font-data tabular-nums text-xs opacity-80">
                  {formatTime(item.startAt)}–{formatTime(item.endAt)}
                </div>
                <div className="mt-0.5 font-medium">{item.appointment.member?.name ?? "ลูกค้า Walk-in"}</div>
                <div className="text-xs opacity-80">{item.serviceVariant.service.name}</div>
                <div className="mt-1 text-[11px] opacity-70">{APPOINTMENT_STATUS_LABEL[item.status]}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

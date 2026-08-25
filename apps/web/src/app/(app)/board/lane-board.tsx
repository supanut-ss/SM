"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@lotus-desk/ui";
import { APPOINTMENT_STATUS_LABEL, ASSIGN_TYPE_LABEL } from "@lotus-desk/contracts";
import type { AppointmentItem } from "../../../lib/api-client";
import { STATUS_STYLE } from "./status-colors";
import {
  durationMinutes,
  durationToWidth,
  minutesToTime,
  snapMinutes,
  timeToX,
  xToMinutesFromStart,
  type TimeGridConfig,
} from "./time-grid";

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 32;
const PX_PER_MIN = 2.4;
const MIN_DURATION_MIN = 15;
/** เกิน 30 แถวแล้ว virtualize จริง (T4.5 เกณฑ์: พนักงาน > 30 คน) — ต่ำกว่านั้น render ปกติ ไม่ต้องเสีย
 * overhead ของ virtualizer โดยไม่จำเป็น */
const VIRTUALIZE_THRESHOLD = 30;

export interface BoardRow {
  id: string;
  label: string;
  sublabel?: string;
}

interface DragGhost {
  itemId: string;
  rowId: string;
  startMin: number;
  durationMin: number;
}

interface ResizePreview {
  itemId: string;
  endMin: number;
}

export function LaneBoard({
  dateKey,
  dayStart,
  boardStartHour,
  boardEndHour,
  rows,
  items,
  rowKeyOf,
  granularityMin,
  now,
  canManage,
  selectedItemId,
  onSelectItem,
  onOpenDetail,
  onReschedule,
}: {
  dateKey: string;
  dayStart: Date;
  boardStartHour: number;
  boardEndHour: number;
  rows: BoardRow[];
  items: AppointmentItem[];
  rowKeyOf: (item: AppointmentItem) => string;
  granularityMin: 15 | 30 | 60;
  now: Date;
  canManage: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onOpenDetail: (item: AppointmentItem) => void;
  onReschedule: (item: AppointmentItem, changes: { rowId: string; startAt: Date; endAt: Date }) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);

  const config: TimeGridConfig = useMemo(() => ({ dayStart, pxPerMin: PX_PER_MIN }), [dayStart]);
  const totalMinutes = (boardEndHour - boardStartHour) * 60;
  const totalWidth = totalMinutes * PX_PER_MIN;

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

  const shouldVirtualize = rows.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const virtualRows = shouldVirtualize
    ? virtualizer.getVirtualItems()
    : rows.map((_, index) => ({ index, start: index * ROW_HEIGHT, size: ROW_HEIGHT, key: index }));
  const totalHeight = shouldVirtualize ? virtualizer.getTotalSize() : rows.length * ROW_HEIGHT;

  const nowX = timeToX(now, config);
  const showNowLine = nowX >= 0 && nowX <= totalWidth;

  // รายการเรียงตามเวลาเพื่อคีย์บอร์ด ArrowLeft/Right (ในแถวเดียวกัน) — ArrowUp/Down สลับแถว
  function itemsInRow(rowId: string): AppointmentItem[] {
    return itemsByRow.get(rowId) ?? [];
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!selectedItemId) return;
    const selected = items.find((i) => i.id === selectedItemId);
    if (!selected) return;
    const rowId = rowKeyOf(selected);
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const rowItems = itemsInRow(rowId);
    const posInRow = rowItems.findIndex((i) => i.id === selectedItemId);

    if (e.key === "Enter") {
      e.preventDefault();
      onOpenDetail(selected);
      return;
    }

    if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      if (!canManage) return;
      e.preventDefault();
      const deltaMin = (e.key === "ArrowRight" ? 1 : -1) * granularityMin;
      const newStart = new Date(new Date(selected.startAt).getTime() + deltaMin * 60_000);
      const newEnd = new Date(new Date(selected.endAt).getTime() + deltaMin * 60_000);
      onReschedule(selected, { rowId, startAt: newStart, endAt: newEnd });
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = posInRow + (e.key === "ArrowRight" ? 1 : -1);
      const next = rowItems[nextIndex];
      if (next) onSelectItem(next.id);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // ข้ามแถวที่ไม่มีนัดเลยไปเรื่อย ๆ จนเจอแถวที่มีนัด หรือสุดขอบ — ไม่งั้นแถวว่างจะบล็อกไม่ให้เลื่อนต่อ
      let nextRowIndex = rowIndex + step;
      let candidates: AppointmentItem[] = [];
      while (rows[nextRowIndex]) {
        candidates = itemsInRow(rows[nextRowIndex]!.id);
        if (candidates.length > 0) break;
        nextRowIndex += step;
      }
      if (candidates.length === 0) return;
      // เลือกตัวที่เวลาเริ่มใกล้กับตัวเดิมที่สุด (คงตำแหน่งแนวนอนไว้คร่าว ๆ ตอนสลับแถว)
      const selectedTime = new Date(selected.startAt).getTime();
      const closest = candidates.reduce((best, cur) =>
        Math.abs(new Date(cur.startAt).getTime() - selectedTime) <
        Math.abs(new Date(best.startAt).getTime() - selectedTime)
          ? cur
          : best,
      );
      onSelectItem(closest.id);
      if (shouldVirtualize) virtualizer.scrollToIndex(nextRowIndex);
      return;
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-DEFAULT border border-line">
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="กระดานคิว — ใช้ลูกศรเลือกนัด, Enter เปิดรายละเอียด, Shift+ลูกศรซ้าย/ขวาเลื่อนเวลา"
      >
        <div style={{ width: totalWidth + 160 }}>
          {/* แถวหัวตาราง: แกนเวลา (sticky ด้านบน) */}
          <div
            className="sticky top-0 z-20 flex border-b border-line bg-surface-sunk"
            style={{ height: HEADER_HEIGHT }}
          >
            <div className="sticky left-0 z-10 w-[160px] shrink-0 border-r border-line bg-surface-sunk" />
            <div className="relative" style={{ width: totalWidth }}>
              {Array.from({ length: totalMinutes / 60 + 1 }, (_, h) => {
                const hour = boardStartHour + h;
                const x = h * 60 * PX_PER_MIN;
                return (
                  <div
                    key={hour}
                    className="absolute top-0 flex h-full items-center border-l border-line text-xs font-data tabular-nums text-ink-muted"
                    style={{ left: x, paddingLeft: 4 }}
                  >
                    {String(hour % 24).padStart(2, "0")}:00
                  </div>
                );
              })}
            </div>
          </div>

          {/* พื้นที่แถวพนักงาน/ห้อง */}
          <div className="relative" style={{ height: totalHeight }}>
            {showNowLine && (
              <div
                className="pointer-events-none absolute top-0 z-10 w-0.5 bg-brass"
                style={{ left: 160 + nowX, height: totalHeight }}
                aria-hidden
              />
            )}

            {virtualRows.map((vRow) => {
              const row = rows[vRow.index];
              if (!row) return null;
              const rowItems = itemsInRow(row.id);
              return (
                <div
                  key={row.id}
                  className="absolute left-0 flex w-full border-b border-line"
                  style={{ top: vRow.start, height: vRow.size }}
                >
                  <div className="sticky left-0 z-10 flex w-[160px] shrink-0 flex-col justify-center border-r border-line bg-surface px-3 py-1">
                    <span className="truncate text-sm font-medium text-ink">{row.label}</span>
                    {row.sublabel && (
                      <span className="truncate text-xs text-ink-faint">{row.sublabel}</span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "relative",
                      ghost?.rowId === row.id && "bg-celadon-tint/40",
                    )}
                    style={{ width: totalWidth }}
                    onDragOver={(e) => {
                      if (!canManage) return;
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("application/json");
                      if (!raw) return;
                      try {
                        const parsed = JSON.parse(raw) as { itemId: string; grabOffsetMin: number };
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const rawStartMin = xToMinutesFromStart(x, config) - parsed.grabOffsetMin;
                        const startMin = snapMinutes(rawStartMin, granularityMin);
                        const draggedItem = items.find((i) => i.id === parsed.itemId);
                        if (!draggedItem) return;
                        setGhost({
                          itemId: parsed.itemId,
                          rowId: row.id,
                          startMin,
                          durationMin: durationMinutes(
                            new Date(draggedItem.startAt),
                            new Date(draggedItem.endAt),
                          ),
                        });
                      } catch {
                        // ignore
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget === e.target) setGhost(null);
                    }}
                    onDrop={(e) => {
                      if (!canManage) return;
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("application/json");
                      setGhost(null);
                      if (!raw) return;
                      const parsed = JSON.parse(raw) as { itemId: string; grabOffsetMin: number };
                      const draggedItem = items.find((i) => i.id === parsed.itemId);
                      if (!draggedItem) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const rawStartMin = xToMinutesFromStart(x, config) - parsed.grabOffsetMin;
                      const startMin = snapMinutes(rawStartMin, granularityMin);
                      const durMin = durationMinutes(
                        new Date(draggedItem.startAt),
                        new Date(draggedItem.endAt),
                      );
                      const newStart = minutesToTime(dayStart, startMin);
                      const newEnd = minutesToTime(dayStart, startMin + durMin);
                      onReschedule(draggedItem, { rowId: row.id, startAt: newStart, endAt: newEnd });
                    }}
                  >
                    {/* เส้นกริดพื้นหลังตาม granularity ปัจจุบัน */}
                    {Array.from({ length: totalMinutes / granularityMin + 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-l border-line/50"
                        style={{ left: i * granularityMin * PX_PER_MIN }}
                      />
                    ))}

                    {ghost?.rowId === row.id && (
                      <div
                        className="pointer-events-none absolute top-1 h-[calc(100%-8px)] rounded-DEFAULT border-2 border-dashed border-celadon bg-celadon-tint/60"
                        style={{
                          left: ghost.startMin * PX_PER_MIN,
                          width: ghost.durationMin * PX_PER_MIN,
                        }}
                      />
                    )}

                    {rowItems.map((item) => {
                      const style = STATUS_STYLE[item.status];
                      const start = new Date(item.startAt);
                      const end = new Date(item.endAt);
                      const x = timeToX(start, config);
                      const previewEndMin =
                        resizePreview?.itemId === item.id ? resizePreview.endMin : null;
                      const width =
                        previewEndMin !== null
                          ? previewEndMin * PX_PER_MIN - x
                          : durationToWidth(start, end, config);
                      const isSelected = selectedItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          draggable={canManage}
                          onDragStart={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const grabOffsetMin = (e.clientX - rect.left) / PX_PER_MIN;
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({ itemId: item.id, grabOffsetMin }),
                            );
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setGhost(null)}
                          onClick={() => {
                            onSelectItem(item.id);
                            // ต้องโฟกัส container ที่ฟัง keydown เอง (คลิก div ที่ไม่มี tabIndex ไม่ทำให้
                            // โฟกัสขยับให้อัตโนมัติ) ไม่งั้นลูกศร/Enter จะใช้ไม่ได้หลังคลิกเลือกบล็อก
                            scrollRef.current?.focus();
                          }}
                          onDoubleClick={() => onOpenDetail(item)}
                          className={cn(
                            "group absolute top-1 h-[calc(100%-8px)] cursor-grab overflow-hidden rounded-DEFAULT px-1.5 py-0.5 text-left text-xs shadow-sm active:cursor-grabbing",
                            style.block,
                            isSelected && "ring-2 ring-celadon ring-offset-1",
                          )}
                          style={{ left: x, width: Math.max(width, 24) }}
                          title={`${item.appointment.member?.name ?? "ลูกค้า"} — ${item.serviceVariant.service.name} (${APPOINTMENT_STATUS_LABEL[item.status]})`}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 w-[3px]",
                              style.spine,
                              style.pulse && "animate-pulse",
                            )}
                          />
                          {item.assignType === "CUSTOMER_REQUEST" && (
                            <span
                              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brass"
                              title={ASSIGN_TYPE_LABEL.CUSTOMER_REQUEST}
                            />
                          )}
                          <div className="truncate pl-1 font-medium">
                            {item.appointment.member?.name ?? "ลูกค้า Walk-in"}
                          </div>
                          <div className="truncate pl-1 font-data tabular-nums opacity-90">
                            {item.serviceVariant.service.name}
                          </div>

                          {canManage && (
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.currentTarget.setPointerCapture(e.pointerId);
                                const startX = e.clientX;
                                const originalEndMin =
                                  (new Date(item.endAt).getTime() - dayStart.getTime()) / 60_000;
                                const startMin =
                                  (new Date(item.startAt).getTime() - dayStart.getTime()) / 60_000;

                                function onMove(ev: PointerEvent) {
                                  const deltaMin = (ev.clientX - startX) / PX_PER_MIN;
                                  const newEndMin = Math.max(
                                    startMin + MIN_DURATION_MIN,
                                    snapMinutes(originalEndMin + deltaMin, granularityMin),
                                  );
                                  setResizePreview({ itemId: item.id, endMin: newEndMin });
                                }
                                function onUp(ev: PointerEvent) {
                                  window.removeEventListener("pointermove", onMove);
                                  window.removeEventListener("pointerup", onUp);
                                  const deltaMin = (ev.clientX - startX) / PX_PER_MIN;
                                  const newEndMin = Math.max(
                                    startMin + MIN_DURATION_MIN,
                                    snapMinutes(originalEndMin + deltaMin, granularityMin),
                                  );
                                  setResizePreview(null);
                                  if (newEndMin !== originalEndMin) {
                                    onReschedule(item, {
                                      rowId: rowKeyOf(item),
                                      startAt: new Date(item.startAt),
                                      endAt: minutesToTime(dayStart, newEndMin),
                                    });
                                  }
                                }
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-line bg-surface-sunk px-3 py-1 text-[11px] text-ink-faint">
        วันที่ {dateKey} — ลูกศรเลือกนัด, Enter เปิดรายละเอียด, Shift+ลูกศรซ้าย/ขวาเลื่อนเวลา
      </p>
    </div>
  );
}

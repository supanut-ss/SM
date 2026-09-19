"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton, SkeletonGroup, EmptyState } from "@lotus-desk/ui";
import { ApiError, appointmentItemApi, staffQueueApi } from "../../../lib/api-client";
import { startOfToday, toDateKey } from "../board/date-format";

const QUEUE_PREVIEW_COUNT = 6;

/**
 * กระดานคิวย่อ (T7.3) — ใช้แหล่งข้อมูลเดียวกับหน้ากระดานคิวเต็ม (T4.5: staffQueueApi + appointmentItemApi
 * ของวันนี้) แต่แสดงแบบย่อ (ลำดับถัดไป + ใครกำลังบริการอยู่) ไม่ใช่รางแนวตั้งแบบ QueueRail ที่ออกแบบมา
 * สำหรับวางข้างกระดานเลน — ดู docs/PLAN.md T7.3
 */
export function QueueSection({ branchId }: { branchId: string }) {
  // lazy initializer เรียกครั้งเดียวตอน mount ไม่ใช่ทุก render (React Compiler ห้ามเรียก new Date() ตรง ๆ
  // ระหว่าง render — ดู react-hooks/purity, แพทเทิร์นเดียวกับ billing-page-client.tsx)
  const [date] = useState(() => startOfToday());
  const dateKey = toDateKey(date);

  const queueQuery = useQuery({
    queryKey: ["staff-queue", branchId, dateKey],
    queryFn: () => staffQueueApi.list(branchId, dateKey),
  });

  const itemsQuery = useQuery({
    queryKey: ["appointment-items", branchId, dateKey],
    queryFn: () => appointmentItemApi.list(branchId, dateKey),
  });

  const isLoading = queueQuery.isLoading || itemsQuery.isLoading;
  const isError = queueQuery.isError || itemsQuery.isError;
  const error = queueQuery.error ?? itemsQuery.error;

  const workingStaffIds = new Set(
    (itemsQuery.data ?? []).filter((i) => i.status === "IN_SERVICE").map((i) => i.staffId),
  );
  const sortedQueue = [...(queueQuery.data ?? [])].sort((a, b) => a.position - b.position);
  const preview = sortedQueue.slice(0, QUEUE_PREVIEW_COUNT);

  return (
    <section aria-label="กระดานคิวย่อ" className="rounded-DEFAULT border border-line-strong bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-balance font-display text-lg font-semibold text-ink">กระดานคิวย่อ</h2>
        <Link href="/board">
          <Button variant="ghost" size="sm">
            ดูกระดานคิวเต็ม →
          </Button>
        </Link>
      </div>

      {isLoading && (
        <SkeletonGroup label="กำลังโหลดกระดานคิวย่อ">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </SkeletonGroup>
      )}

      {isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {error instanceof ApiError ? error.message : "โหลดกระดานคิวย่อไม่สำเร็จ กรุณาลองใหม่"}
          <Button
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => {
              void queueQuery.refetch();
              void itemsQuery.refetch();
            }}
          >
            ลองใหม่
          </Button>
        </div>
      )}

      {!isLoading && !isError && sortedQueue.length === 0 && (
        <EmptyState
          className="p-6"
          title="ยังไม่มีใครเข้าคิววันนี้"
          action={
            <Link href="/board">
              <Button variant="secondary" size="sm">
                ไปที่กระดานคิวเต็ม
              </Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && sortedQueue.length > 0 && (
        <ol className="grid gap-1.5">
          {preview.map((entry, i) => {
            const working = workingStaffIds.has(entry.staffId);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-DEFAULT border border-line px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-data w-5 tabular-nums text-ink-faint">{i + 1}</span>
                  <span className="text-sm text-ink">{entry.staff.name}</span>
                </div>
                {working && (
                  <span className="inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon">
                    กำลังบริการ
                  </span>
                )}
              </li>
            );
          })}
          {sortedQueue.length > QUEUE_PREVIEW_COUNT && (
            <li className="pt-1 text-center text-xs text-ink-muted">
              และอีก {sortedQueue.length - QUEUE_PREVIEW_COUNT} คนในคิว — ดูทั้งหมดที่กระดานคิวเต็ม
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

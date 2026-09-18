"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Select } from "@lotus-desk/ui";
import {
  ApiError,
  appointmentItemApi,
  roomApi,
  staffApi,
  staffQueueApi,
  type AppointmentItem,
} from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { addDays, bangkokInstant, startOfToday, toDateKey } from "./date-format";
import { AppointmentDetailSheet } from "./appointment-detail-sheet";
import { LaneBoard, type BoardRow } from "./lane-board";
import { MobileAgenda } from "./mobile-agenda";
import { QueueRail } from "./queue-rail";
import { WalkInSheet } from "./walk-in-sheet";
import type { AppointmentStatus, PaymentMethod } from "@lotus-desk/contracts";

type ViewMode = "staff" | "room";
type Granularity = 15 | 30 | 60;

const BOARD_START_HOUR = 8;
const BOARD_END_HOUR = 22; // 14 ชม. — ตรงกับเกณฑ์ประสิทธิภาพของ T4.5 (พนักงาน 40 คน × 14 ชม.)
/** ดึงข้อมูลใหม่ทุก 20 วินาที (ดู docs/PLAN.md T4.5 — "polling ทุก 20 วินาที หรือ SSE ถ้าทำได้") */
const POLL_INTERVAL_MS = 20_000;

export function BoardPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "booking");

  const [date, setDate] = useState(() => startOfToday());
  const [viewMode, setViewMode] = useState<ViewMode>("staff");
  const [granularity, setGranularity] = useState<Granularity>(30);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const dateKey = toDateKey(date);
  const dayStart = useMemo(() => bangkokInstant(dateKey, BOARD_START_HOUR), [dateKey]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const itemsKey = ["appointment-items", branch?.branchId, dateKey];
  const queueKey = ["staff-queue", branch?.branchId, dateKey];

  const staffQuery = useQuery({
    queryKey: ["staff", branch?.branchId, "", "true"],
    queryFn: () => staffApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms", branch?.branchId, "", "true"],
    queryFn: () => roomApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const itemsQuery = useQuery({
    queryKey: itemsKey,
    queryFn: () => appointmentItemApi.list(branch!.branchId, dateKey),
    enabled: !!branch?.branchId,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const queueQuery = useQuery({
    queryKey: queueKey,
    queryFn: () => staffQueueApi.list(branch!.branchId, dateKey),
    enabled: !!branch?.branchId,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({
      item,
      staffId,
      roomId,
      startAt,
      endAt,
    }: {
      item: AppointmentItem;
      staffId: string;
      roomId: string;
      startAt: Date;
      endAt: Date;
    }) =>
      appointmentItemApi.reschedule(branch!.branchId, item.id, { staffId, roomId, startAt, endAt }),
    onMutate: async ({ item, staffId, roomId, startAt, endAt }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey });
      const previous = queryClient.getQueryData<AppointmentItem[]>(itemsKey);
      queryClient.setQueryData<AppointmentItem[]>(itemsKey, (old) =>
        (old ?? []).map((i) =>
          i.id === item.id
            ? { ...i, staffId, roomId, startAt: startAt.toISOString(), endAt: endAt.toISOString() }
            : i,
        ),
      );
      setError(null);
      return { previous };
    },
    onError: (err, _vars, context) => {
      // "ลากแล้วชนต้องเด้งกลับพร้อมบอกเหตุผล" (T4.5) — rollback ค่าเดิมกลับ + แสดงเหตุผลจริงจาก API
      if (context?.previous) queryClient.setQueryData(itemsKey, context.previous);
      setError(err instanceof ApiError ? err.message : "ย้ายนัดไม่สำเร็จ กรุณาลองใหม่");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: itemsKey }),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      item,
      status,
      paymentMethod,
      memberPackageId,
    }: {
      item: AppointmentItem;
      status: AppointmentStatus;
      paymentMethod?: PaymentMethod;
      memberPackageId?: string;
    }) => appointmentItemApi.updateStatus(branch!.branchId, item.id, { status, paymentMethod, memberPackageId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: itemsKey });
      void queryClient.invalidateQueries({ queryKey: queueKey });
      setError(null);
      setDetailItemId(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ"),
  });

  // เข้าคิวหมุน (T4.4) — API มีอยู่แล้วแต่ไม่เคยมีปุ่มในหน้าเว็บเลย พนักงานที่ยังไม่มีนัดวันนั้นเลยไม่มีทาง
  // เข้าคิวได้ (ระบบเดิมเข้าคิวให้อัตโนมัติแค่ตอนนัด "แรก" ของวันจบ/ยกเลิก ไม่ใช่ตอนเริ่มวัน) ดู
  // docs/decisions.md ADR-049
  const joinQueueMutation = useMutation({
    mutationFn: (staffId: string) => staffQueueApi.join(branch!.branchId, { staffId, date }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKey });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "เข้าคิวไม่สำเร็จ กรุณาลองใหม่"),
  });

  function handleReschedule(item: AppointmentItem, changes: { rowId: string; startAt: Date; endAt: Date }) {
    const staffId = viewMode === "staff" ? changes.rowId : item.staffId;
    const roomId = viewMode === "room" ? changes.rowId : item.roomId;
    rescheduleMutation.mutate({ item, staffId, roomId, startAt: changes.startAt, endAt: changes.endAt });
  }

  const rows: BoardRow[] = useMemo(() => {
    if (viewMode === "staff") {
      return (staffQuery.data ?? []).map((s) => ({ id: s.id, label: s.name }));
    }
    return (roomsQuery.data ?? []).map((r) => ({ id: r.id, label: r.name, sublabel: r.roomType.name }));
  }, [viewMode, staffQuery.data, roomsQuery.data]);

  const rowKeyOf = (item: AppointmentItem) => (viewMode === "staff" ? item.staffId : item.roomId);

  const detailItem = (itemsQuery.data ?? []).find((i) => i.id === detailItemId) ?? null;

  const queuedStaffIds = new Set((queueQuery.data ?? []).map((e) => e.staffId));
  const staffNotInQueue = (staffQuery.data ?? []).filter((s) => !queuedStaffIds.has(s.id));

  if (!branch) {
    return (
      <div className="p-8">
        <p className="rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  const isLoading = staffQuery.isLoading || roomsQuery.isLoading || itemsQuery.isLoading;
  const isError = staffQuery.isError || roomsQuery.isError || itemsQuery.isError;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">กระดานคิว</h1>
          <p className="mt-1 text-sm text-ink-muted">สาขา {branch.branchName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button size="sm" onClick={() => setWalkInOpen(true)}>
              + จองด่วน
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setDate((d) => addDays(d, -1))}>
            ◀ วันก่อน
          </Button>
          <span className="font-data tabular-nums text-sm text-ink">
            {date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setDate((d) => addDays(d, 1))}>
            วันถัดไป ▶
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(startOfToday())}>
            วันนี้
          </Button>
          <Select
            aria-label="มุมมอง"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            className="w-32"
          >
            <option value="staff">มุมมองพนักงาน</option>
            <option value="room">มุมมองห้อง</option>
          </Select>
          <Select
            aria-label="ความละเอียดเวลา"
            value={String(granularity)}
            onChange={(e) => setGranularity(Number(e.target.value) as Granularity)}
            className="w-28"
          >
            <option value="15">15 นาที</option>
            <option value="30">30 นาที</option>
            <option value="60">60 นาที</option>
          </Select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {error}
        </p>
      )}

      {isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดกระดานคิว">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          โหลดกระดานคิวไม่สำเร็จ กรุณาลองใหม่
          <Button
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => {
              void staffQuery.refetch();
              void roomsQuery.refetch();
              void itemsQuery.refetch();
            }}
          >
            ลองใหม่
          </Button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-ink-muted">
            {viewMode === "staff" ? "ยังไม่มีพนักงานในสาขานี้" : "ยังไม่มีห้องในสาขานี้"}
          </p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          {/* จอกว้าง (>= md): Lane Board grid เวลา×แถวเดิม ลาก-วางได้ (ดู docs/DESIGN.md §5) */}
          <div className="hidden flex-1 gap-0 overflow-hidden md:flex">
            <QueueRail
              queue={queueQuery.data ?? []}
              items={itemsQuery.data ?? []}
              onSelectStaff={(staffId) => {
                // เลือกนัดแรกของพนักงานคนนี้บนกระดาน (ถ้ามี) — ยังไม่มี scroll-to-row จริง (ยกไปอนาคน)
                const firstItem = (itemsQuery.data ?? []).find((i) => i.staffId === staffId);
                if (firstItem) setSelectedItemId(firstItem.id);
              }}
              notInQueue={canManage ? staffNotInQueue : []}
              onJoinQueue={(staffId) => joinQueueMutation.mutate(staffId)}
              isJoining={joinQueueMutation.isPending}
            />
            <LaneBoard
              dateKey={dateKey}
              dayStart={dayStart}
              boardStartHour={BOARD_START_HOUR}
              boardEndHour={BOARD_END_HOUR}
              rows={rows}
              items={itemsQuery.data ?? []}
              rowKeyOf={rowKeyOf}
              granularityMin={granularity}
              now={now}
              canManage={canManage}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              onOpenDetail={(item) => setDetailItemId(item.id)}
              onReschedule={handleReschedule}
            />
          </div>

          {/* จอแคบ (< md): มุมมองรายคนแนวตั้ง ไม่มี drag-and-drop (T10.5, ดู docs/DESIGN.md §9.4) */}
          <div className="flex-1 overflow-hidden md:hidden">
            <MobileAgenda
              key={`${viewMode}-${dateKey}`}
              rows={rows}
              items={itemsQuery.data ?? []}
              rowKeyOf={rowKeyOf}
              queue={viewMode === "staff" ? (queueQuery.data ?? []) : undefined}
              onOpenDetail={(item) => setDetailItemId(item.id)}
            />
          </div>
        </>
      )}

      <AppointmentDetailSheet
        item={detailItem}
        onClose={() => setDetailItemId(null)}
        canManage={canManage}
        isPending={statusMutation.isPending}
        errorMessage={error}
        onChangeStatus={(item, status, paymentMethod, memberPackageId) =>
          statusMutation.mutate({ item, status, paymentMethod, memberPackageId })
        }
      />

      <WalkInSheet
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        branchId={branch.branchId}
        onBooked={() => {
          void queryClient.invalidateQueries({ queryKey: itemsKey });
          void queryClient.invalidateQueries({ queryKey: queueKey });
        }}
      />
    </div>
  );
}

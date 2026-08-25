"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@lotus-desk/ui";
import {
  ApiError,
  attendanceApi,
  type AttendanceDailySummaryRow,
  type AttendanceShiftStatus,
} from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// สีสถานะยืมมาจากชุดเดียวกับ Lane Board (docs/DESIGN.md §3.3) เพื่อไม่ต้องคิดสีใหม่: UPCOMING เหมือน
// "จองไว้" (indigo), IN_PROGRESS เหมือน "กำลังบริการ" (celadon ทึบ), COMPLETED เหมือน "เสร็จแล้ว"
// (ink-faint), ABSENT เหมือน "ไม่มา" (rose)
const STATUS_STYLE: Record<AttendanceShiftStatus, string> = {
  UPCOMING: "border border-dashed border-indigo bg-indigo-tint text-indigo",
  IN_PROGRESS: "bg-celadon text-white",
  COMPLETED: "bg-surface-sunk text-ink-faint",
  ABSENT: "bg-rose-tint text-rose",
};

const STATUS_LABEL: Record<AttendanceShiftStatus, string> = {
  UPCOMING: "ยังไม่ถึงเวลา",
  IN_PROGRESS: "กำลังทำงาน",
  COMPLETED: "เสร็จกะแล้ว",
  ABSENT: "ขาด",
};

function StatusPill({ status }: { status: AttendanceShiftStatus }) {
  return (
    <span className={`inline-flex rounded-DEFAULT px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** แผงลงเวลาเข้า/ออกงานของ "ฉัน" (T6.1) — พนักงานที่ล็อกอินด้วย PIN ที่เครื่องหน้าร้านใช้ปุ่มเดียวนี้ */
function MyClockPanel({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient();
  const meKey = ["attendance-me", branchId];

  const meQuery = useQuery({
    queryKey: meKey,
    queryFn: () => attendanceApi.me(branchId),
    refetchInterval: 30_000,
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: meKey });
    void queryClient.invalidateQueries({ queryKey: ["attendance-summary", branchId] });
  }

  const clockInMutation = useMutation({
    mutationFn: () => attendanceApi.clockIn(branchId),
    onSuccess: invalidateAll,
  });
  const clockOutMutation = useMutation({
    mutationFn: () => attendanceApi.clockOut(branchId),
    onSuccess: invalidateAll,
  });

  const actionError = clockInMutation.error ?? clockOutMutation.error;

  return (
    <div className="mb-6 rounded-DEFAULT border border-line-strong bg-surface p-6">
      <h2 className="font-display text-lg font-semibold text-ink">ลงเวลาของฉัน</h2>

      {meQuery.isLoading && (
        <div className="mt-3 h-10 w-40 animate-pulse rounded-DEFAULT bg-surface-sunk" aria-busy="true" />
      )}

      {meQuery.isError && (
        <div className="mt-3 rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {meQuery.error instanceof ApiError ? meQuery.error.message : "โหลดสถานะลงเวลาไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void meQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {meQuery.isSuccess && meQuery.data.staffId === null && (
        <p className="mt-3 rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับพนักงานคนใด — ให้ผู้จัดการไปผูกบัญชีที่หน้า &ldquo;พนักงาน&rdquo; (แก้ไขพนักงาน →
          บัญชีที่ใช้ลงเวลาทำงาน) ก่อนถึงจะลงเวลาได้
        </p>
      )}

      {meQuery.isSuccess && meQuery.data.staffId !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm text-ink-muted">{meQuery.data.staffName}</p>
            {meQuery.data.openRecord ? (
              <p className="mt-0.5 text-sm text-celadon">
                เข้างานเมื่อ {formatTime(meQuery.data.openRecord.clockInAt)}
                {meQuery.data.openRecord.lateMinutes ? ` (สาย ${meQuery.data.openRecord.lateMinutes} นาที)` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-ink-faint">ยังไม่ได้ลงเวลาเข้างาน</p>
            )}
          </div>
          {meQuery.data.openRecord ? (
            <Button
              variant="secondary"
              disabled={clockOutMutation.isPending}
              onClick={() => clockOutMutation.mutate()}
            >
              {clockOutMutation.isPending ? "กำลังลงเวลา..." : "ออกงาน"}
            </Button>
          ) : (
            <Button disabled={clockInMutation.isPending} onClick={() => clockInMutation.mutate()}>
              {clockInMutation.isPending ? "กำลังลงเวลา..." : "เข้างาน"}
            </Button>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-3 rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {actionError instanceof ApiError ? actionError.message : "ลงเวลาไม่สำเร็จ กรุณาลองใหม่"}
        </p>
      )}
    </div>
  );
}

/** สรุปสถานะรายกะของทุกคนวันนี้ (สาย/ขาด/กำลังทำงาน) — เฉพาะผู้มีสิทธิ์ attendance:view (ผู้จัดการ/เจ้าของ) */
function DailySummaryTable({ branchId }: { branchId: string }) {
  const summaryQuery = useQuery({
    queryKey: ["attendance-summary", branchId],
    queryFn: () => attendanceApi.summary(branchId),
    refetchInterval: 30_000,
  });

  return (
    <div className="rounded-DEFAULT border border-line-strong bg-surface p-6">
      <h2 className="font-display text-lg font-semibold text-ink">สรุปวันนี้</h2>

      {summaryQuery.isLoading && (
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="กำลังโหลดสรุปการลงเวลา">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {summaryQuery.isError && (
        <div className="mt-3 rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {summaryQuery.error instanceof ApiError
            ? summaryQuery.error.message
            : "โหลดสรุปการลงเวลาไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void summaryQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {summaryQuery.isSuccess && summaryQuery.data.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          วันนี้ยังไม่มีใครมีตารางกะ — ไปตั้งตารางกะได้ที่หน้า &ldquo;พนักงาน&rdquo; → จัดตารางกะ
        </p>
      )}

      {summaryQuery.isSuccess && summaryQuery.data.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {summaryQuery.data.map((row: AttendanceDailySummaryRow) => (
            <li key={row.staffShiftId} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">{row.staffName}</p>
                <p className="font-data text-xs tabular-nums text-ink-muted">
                  {formatMin(row.startMin)}–{formatMin(row.endMin)}
                </p>
              </div>
              <StatusPill status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AttendancePageClient() {
  const branch = useCurrentBranch();
  const canView = hasPermission(branch?.permissions ?? [], "view", "attendance");

  if (!branch) {
    return (
      <div className="p-8">
        <p className="rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">ลงเวลาทำงาน</h1>
        <p className="mt-1 text-sm text-ink-muted">สาขา {branch.branchName}</p>
      </div>

      <MyClockPanel branchId={branch.branchId} />
      {canView && <DailySummaryTable branchId={branch.branchId} />}
    </div>
  );
}

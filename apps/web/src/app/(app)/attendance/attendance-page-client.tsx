"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STAFF_LEVEL_LABEL } from "@lotus-desk/contracts";
import { Button, ListCard, ResponsiveList, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import type { ReactNode } from "react";
import {
  ApiError,
  attendanceApi,
  staffApi,
  type AttendanceRow,
  type AttendanceStatus,
  type StaffProfile,
} from "../../../lib/api-client";
import { minToTimeString } from "../staff/shifts/time-format";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";

/** สถานะวันนี้ของพนักงาน 1 คน (มาแล้ว/กำลังทำงาน/กลับแล้ว) — อนุมานจาก TimeClockEntry ล่าสุด ไม่ใช่จาก
 * attendance.status ของ evaluateAttendance (นั่นคือผลเทียบกับกะ ไม่ใช่สถานะการมาทำงาน) */
type TodayStatus = "NOT_ARRIVED" | "WORKING" | "DONE";

function todayStatus(row: AttendanceRow | undefined): TodayStatus {
  if (!row || !row.clockInAt) return "NOT_ARRIVED";
  if (!row.clockOutAt) return "WORKING";
  return "DONE";
}

const TODAY_STATUS_LABEL: Record<TodayStatus, string> = {
  NOT_ARRIVED: "ยังไม่มา",
  WORKING: "กำลังทำงาน",
  DONE: "กลับแล้ว",
};

const TODAY_STATUS_STYLE: Record<TodayStatus, string> = {
  NOT_ARRIVED: "bg-surface-sunk text-ink-faint",
  WORKING: "bg-celadon-solid text-white",
  DONE: "bg-surface-sunk text-ink-muted",
};

const SHIFT_STATUS_LABEL: Record<AttendanceStatus, string> = {
  ON_TIME: "ตรงเวลา",
  LATE: "สาย",
  LEFT_EARLY: "ออกก่อน",
  LATE_AND_LEFT_EARLY: "สาย+ออกก่อน",
  ABSENT: "ขาด",
  NO_SHIFT: "ไม่มีกะ",
};

const SHIFT_STATUS_STYLE: Record<AttendanceStatus, string> = {
  ON_TIME: "border border-line-strong text-ink-muted",
  LATE: "bg-brass-tint text-brass",
  LEFT_EARLY: "bg-brass-tint text-brass",
  LATE_AND_LEFT_EARLY: "bg-rose-tint text-rose",
  ABSENT: "bg-rose-tint text-rose",
  NO_SHIFT: "border border-dashed border-line text-ink-faint",
};

function formatClockTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

interface RosterRow {
  staff: StaffProfile;
  entry: AttendanceRow | undefined;
}

/**
 * โรสเตอร์ลงเวลาเข้า-ออกงาน (T6.1) — แคชเชียร์/ผู้จัดการ/เจ้าของเป็นคนกดแทนพนักงาน ไม่มีช่องกรอก PIN
 * ในหน้านี้เลย รวมพนักงานทำงานทุกคนของสาขา (staffApi.list) เข้ากับรายการลงเวลาวันนี้ (attendanceApi.list)
 * เพื่อให้เห็นครบทุกคนแม้ยังไม่มีรายการลงเวลาเลยก็ตาม
 */
export function AttendancePageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "attendance");

  const staffKey = ["attendance-staff-roster", branch?.branchId];
  const attendanceKey = ["attendance-today", branch?.branchId];

  const staffQuery = useQuery({
    queryKey: staffKey,
    queryFn: () => staffApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const attendanceQuery = useQuery({
    queryKey: attendanceKey,
    queryFn: () => attendanceApi.list(branch!.branchId),
    enabled: !!branch?.branchId,
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: attendanceKey });
  }

  const clockInMutation = useMutation({
    mutationFn: (staffId: string) => attendanceApi.clockIn(branch!.branchId, staffId),
    onSuccess: invalidateAll,
  });

  const clockOutMutation = useMutation({
    mutationFn: (staffId: string) => attendanceApi.clockOut(branch!.branchId, staffId),
    onSuccess: invalidateAll,
  });

  const rows = useMemo<RosterRow[]>(() => {
    const entryByStaffId = new Map((attendanceQuery.data ?? []).map((r) => [r.staffId, r]));
    return (staffQuery.data ?? [])
      .map((staff) => ({ staff, entry: entryByStaffId.get(staff.id) }))
      .sort((a, b) => a.staff.name.localeCompare(b.staff.name, "th"));
  }, [staffQuery.data, attendanceQuery.data]);

  const arrivedCount = rows.filter((r) => todayStatus(r.entry) !== "NOT_ARRIVED").length;

  const isLoading = staffQuery.isLoading || attendanceQuery.isLoading;
  const isError = staffQuery.isError || attendanceQuery.isError;
  const isSuccess = staffQuery.isSuccess && attendanceQuery.isSuccess;
  const errorMessage =
    (staffQuery.error instanceof ApiError && staffQuery.error.message) ||
    (attendanceQuery.error instanceof ApiError && attendanceQuery.error.message) ||
    "โหลดข้อมูลลงเวลาไม่สำเร็จ กรุณาลองใหม่";

  function retry() {
    void staffQuery.refetch();
    void attendanceQuery.refetch();
  }

  function renderTodayBadge(status: TodayStatus): ReactNode {
    return (
      <span className={`inline-flex rounded-DEFAULT px-2 py-0.5 text-xs font-medium ${TODAY_STATUS_STYLE[status]}`}>
        {TODAY_STATUS_LABEL[status]}
      </span>
    );
  }

  function renderShiftInfo(entry: AttendanceRow | undefined): ReactNode {
    if (!entry?.clockInAt) return <span className="text-xs text-ink-faint">—</span>;
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className={`inline-flex rounded-DEFAULT px-2 py-0.5 text-xs font-medium ${SHIFT_STATUS_STYLE[entry.attendance.status]}`}>
          {SHIFT_STATUS_LABEL[entry.attendance.status]}
        </span>
        {entry.attendance.otMinutes > 0 && (
          <span className="inline-flex rounded-DEFAULT bg-indigo-tint px-2 py-0.5 text-xs font-medium text-indigo">
            OT {entry.attendance.otMinutes} นาที
          </span>
        )}
        {entry.shift && (
          <span className="text-xs text-ink-faint">
            (กะ {minToTimeString(entry.shift.startMin)}-{minToTimeString(entry.shift.endMin)})
          </span>
        )}
      </div>
    );
  }

  function renderClockAction(staff: StaffProfile, status: TodayStatus): ReactNode {
    const pendingIn = clockInMutation.isPending && clockInMutation.variables === staff.id;
    const pendingOut = clockOutMutation.isPending && clockOutMutation.variables === staff.id;
    if (canManage && status === "NOT_ARRIVED") {
      return (
        <Button size="sm" disabled={pendingIn} onClick={() => clockInMutation.mutate(staff.id)}>
          {pendingIn ? "กำลังลงเวลา..." : "ลงเวลาเข้า"}
        </Button>
      );
    }
    if (canManage && status === "WORKING") {
      return (
        <Button size="sm" variant="secondary" disabled={pendingOut} onClick={() => clockOutMutation.mutate(staff.id)}>
          {pendingOut ? "กำลังลงเวลา..." : "ลงเวลาออก"}
        </Button>
      );
    }
    return null;
  }

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">ลงเวลาเข้า-ออกงาน</h1>
          <p className="mt-1 text-sm text-ink-muted">
            รายชื่อพนักงานทำงานวันนี้ของสาขา {branch.branchName} — แคชเชียร์/ผู้จัดการลงเวลาแทนพนักงานได้เลย ไม่ต้องใช้ PIN
          </p>
        </div>
        {isSuccess && rows.length > 0 && (
          <div className="rounded-DEFAULT border border-line-strong bg-surface px-4 py-2 text-sm">
            <span className="font-data tabular-nums font-semibold text-ink">
              {arrivedCount}/{rows.length}
            </span>{" "}
            <span className="text-ink-muted">คนมาแล้ววันนี้</span>
          </div>
        )}
      </div>

      {isLoading && (
        <SkeletonGroup label="กำลังโหลดรายการลงเวลา">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </SkeletonGroup>
      )}

      {!isLoading && isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {errorMessage}
          <Button variant="secondary" size="sm" className="ml-3" onClick={retry}>
            ลองใหม่
          </Button>
        </div>
      )}

      {!isLoading && !isError && isSuccess && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-ink-muted">ยังไม่มีพนักงานในสาขานี้</p>
          <p className="mt-1 text-xs text-ink-faint">ไปที่หน้า &quot;พนักงาน&quot; เพื่อเพิ่มพนักงานก่อน</p>
        </div>
      )}

      {!isLoading && !isError && isSuccess && rows.length > 0 && (
        <ResponsiveList
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ระดับ</TableHead>
                  <TableHead>สถานะวันนี้</TableHead>
                  <TableHead>เข้างาน</TableHead>
                  <TableHead>ออกงาน</TableHead>
                  <TableHead>เทียบกะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ staff, entry }) => {
                  const status = todayStatus(entry);
                  return (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>{STAFF_LEVEL_LABEL[staff.level]}</TableCell>
                      <TableCell>{renderTodayBadge(status)}</TableCell>
                      <TableCell className="font-data tabular-nums">{formatClockTime(entry?.clockInAt ?? null)}</TableCell>
                      <TableCell className="font-data tabular-nums">{formatClockTime(entry?.clockOutAt ?? null)}</TableCell>
                      <TableCell>{renderShiftInfo(entry)}</TableCell>
                      <TableCell className="text-right">{renderClockAction(staff, status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          }
          cards={rows.map(({ staff, entry }) => {
            const status = todayStatus(entry);
            return (
              <ListCard
                key={staff.id}
                title={staff.name}
                badge={renderTodayBadge(status)}
                lines={[
                  `${STAFF_LEVEL_LABEL[staff.level]} · เข้า ${formatClockTime(entry?.clockInAt ?? null)} · ออก ${formatClockTime(entry?.clockOutAt ?? null)}`,
                ]}
                actions={
                  <>
                    {renderShiftInfo(entry)}
                    {renderClockAction(staff, status)}
                  </>
                }
              />
            );
          })}
        />
      )}

      {(clockInMutation.isError || clockOutMutation.isError) && (
        <p role="alert" className="mt-4 rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {clockInMutation.error instanceof ApiError
            ? clockInMutation.error.message
            : clockOutMutation.error instanceof ApiError
              ? clockOutMutation.error.message
              : "ลงเวลาไม่สำเร็จ กรุณาลองใหม่"}
        </p>
      )}
    </div>
  );
}

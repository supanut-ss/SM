"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { STAFF_LEVEL_LABEL, type StaffLevel } from "@lotus-desk/contracts";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, SkeletonGroup, EmptyState } from "@lotus-desk/ui";
import { ApiError, type StaffUtilizationReport } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

interface StaffAggregate {
  staffId: string;
  name: string;
  level: StaffLevel;
  scheduledMinutes: number;
  workedMinutes: number;
  jobCount: number;
  commissionSatang: number;
}

/** รวมแถวรายวันต่อพนักงาน (DailyStaffSummaryRow) เป็น 1 แถวต่อคนตลอดช่วงที่เลือก — ชื่อ/ระดับใช้ค่าจากแถว
 * ล่าสุด (เผื่อพนักงานเลื่อนระดับระหว่างช่วง ให้ตารางแสดงระดับปัจจุบันสุดท้ายที่มีข้อมูล ไม่ใช่ระดับวันแรก) */
function aggregateByStaff(days: StaffUtilizationReport["days"]): StaffAggregate[] {
  const byStaffId = new Map<string, StaffAggregate>();
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const existing = byStaffId.get(day.staffId);
    if (existing) {
      existing.scheduledMinutes += day.scheduledMinutes;
      existing.workedMinutes += day.workedMinutes;
      existing.jobCount += day.jobCount;
      existing.commissionSatang += day.commissionSatang;
      existing.name = day.staff.name;
      existing.level = day.staff.level;
    } else {
      byStaffId.set(day.staffId, {
        staffId: day.staffId,
        name: day.staff.name,
        level: day.staff.level,
        scheduledMinutes: day.scheduledMinutes,
        workedMinutes: day.workedMinutes,
        jobCount: day.jobCount,
        commissionSatang: day.commissionSatang,
      });
    }
  }
  return [...byStaffId.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

function formatUtilization(workedMinutes: number, scheduledMinutes: number): string {
  if (scheduledMinutes <= 0) return "—";
  return `${((workedMinutes / scheduledMinutes) * 100).toFixed(1)}%`;
}

/** T7.4 ส่วนที่ 3 — ตารางสรุปชั่วโมงทำงาน/ค่ามือต่อพนักงาน รวมทั้งช่วงที่เลือก */
export function StaffUtilizationSection({
  query,
}: {
  query: UseQueryResult<StaffUtilizationReport, unknown>;
}) {
  const rows = query.data ? aggregateByStaff(query.data.days) : [];

  return (
    <section
      aria-label="ตารางชั่วโมงทำงานและค่ามือพนักงาน"
      className="rounded-DEFAULT border border-line-strong bg-surface p-4 lg:col-span-2"
    >
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">ชั่วโมงทำงานและค่ามือต่อพนักงาน</h2>

      {query.isLoading && (
        <SkeletonGroup label="กำลังโหลดตารางพนักงาน">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </SkeletonGroup>
      )}

      {query.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {query.error instanceof ApiError ? query.error.message : "โหลดตารางพนักงานไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void query.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {query.isSuccess && rows.length === 0 && (
        <EmptyState
          className="p-6"
          title="ไม่มีข้อมูลในช่วงที่เลือก"
          description={'ลองขยายช่วงวันที่ หรือเลือก "พนักงานทั้งหมด"'}
        />
      )}

      {query.isSuccess && rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>ระดับ</TableHead>
              <TableHead className="text-right">นาทีตามกะ</TableHead>
              <TableHead className="text-right">นาทีทำงานจริง</TableHead>
              <TableHead className="text-right">% การใช้งาน</TableHead>
              <TableHead className="text-right">จำนวนใบงาน</TableHead>
              <TableHead className="text-right">ค่ามือรวม</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.staffId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{STAFF_LEVEL_LABEL[row.level]}</TableCell>
                <TableCell className="text-right font-data tabular-nums">
                  {row.scheduledMinutes.toLocaleString("th-TH")}
                </TableCell>
                <TableCell className="text-right font-data tabular-nums">
                  {row.workedMinutes.toLocaleString("th-TH")}
                </TableCell>
                <TableCell className="text-right font-data tabular-nums">
                  {formatUtilization(row.workedMinutes, row.scheduledMinutes)}
                </TableCell>
                <TableCell className="text-right font-data tabular-nums">
                  {row.jobCount.toLocaleString("th-TH")}
                </TableCell>
                <TableCell className="text-right font-data tabular-nums">
                  {formatSatang(row.commissionSatang)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

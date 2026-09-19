"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STAFF_LEVEL_LABEL } from "@lotus-desk/contracts";
import { Button, ListCard, ResponsiveList, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, SkeletonGroup, EmptyState } from "@lotus-desk/ui";
import {
  ApiError,
  payrollApi,
  type PayrollPeriod,
  type PayrollPeriodStaffSummary,
} from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { ManagerPinDialog } from "../billing/manager-pin-dialog";
import { Payslip } from "./payslip";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function xlsxDownloadHref(branchId: string, periodId: string): string {
  return `/api/branches/${branchId}/payroll/periods/${periodId}/summary.xlsx`;
}

/** ตารางสรุปค่ามือต่อพนักงานของ 1 งวด — ใช้ซ้ำทั้งตอนปิดงวดสำเร็จและตอน "ดูสรุป" ของประวัติงวดเก่า */
function StaffSummaryTable({
  summaries,
  onPrint,
}: {
  summaries: PayrollPeriodStaffSummary[];
  onPrint: (summary: PayrollPeriodStaffSummary) => void;
}) {
  if (summaries.length === 0) {
    return <p className="text-pretty text-sm text-ink-muted">งวดนี้ไม่มีรายการค่ามือ/ทิปเลย</p>;
  }
  return (
    <ResponsiveList
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>พนักงาน</TableHead>
              <TableHead>ระดับ</TableHead>
              <TableHead className="text-right">ใบงาน</TableHead>
              <TableHead className="text-right">ค่ามือ</TableHead>
              <TableHead className="text-right">ทิป</TableHead>
              <TableHead className="text-right">หัก</TableHead>
              <TableHead className="text-right">รวมสุทธิ</TableHead>
              <TableHead className="text-right print:hidden">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.staff.name}</TableCell>
                <TableCell>{STAFF_LEVEL_LABEL[s.staff.level]}</TableCell>
                <TableCell className="text-right font-data tabular-nums">{s.jobCount}</TableCell>
                <TableCell className="text-right font-data tabular-nums">{formatSatang(s.commissionSatang)}</TableCell>
                <TableCell className="text-right font-data tabular-nums">{formatSatang(s.tipSatang)}</TableCell>
                <TableCell className="text-right font-data tabular-nums">{formatSatang(s.deductionSatang)}</TableCell>
                <TableCell className="text-right font-data tabular-nums font-semibold">
                  {formatSatang(s.totalSatang)}
                </TableCell>
                <TableCell className="text-right print:hidden">
                  <Button variant="ghost" size="sm" onClick={() => onPrint(s)}>
                    พิมพ์สลิป
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      cards={summaries.map((s) => (
        <ListCard
          key={s.id}
          title={s.staff.name}
          lines={[
            `${STAFF_LEVEL_LABEL[s.staff.level]} · ${s.jobCount} ใบงาน`,
            `ค่ามือ ${formatSatang(s.commissionSatang)} · ทิป ${formatSatang(s.tipSatang)} · หัก ${formatSatang(s.deductionSatang)}`,
          ]}
          badge={<span className="font-data text-sm font-semibold tabular-nums text-ink">{formatSatang(s.totalSatang)}</span>}
          actions={
            <Button variant="ghost" size="sm" onClick={() => onPrint(s)}>
              พิมพ์สลิป
            </Button>
          }
        />
      ))}
    />
  );
}

/** แถวประวัติงวดที่ปิดแล้ว 1 งวด — กด "ดูสรุป" เพื่อโหลดสรุปต่อพนักงานแบบ inline (ไม่ navigate ออกจากหน้า) */
function ClosedPeriodRow({
  branchId,
  period,
  canManage,
  expanded,
  onToggleExpand,
  onReopenClick,
  onPrint,
}: {
  branchId: string;
  period: PayrollPeriod;
  canManage: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onReopenClick: () => void;
  onPrint: (summary: PayrollPeriodStaffSummary) => void;
}) {
  const summaryQuery = useQuery({
    queryKey: ["payroll-summary", branchId, period.id],
    queryFn: () => payrollApi.summary(branchId, period.id),
    enabled: expanded,
  });

  return (
    <li className="rounded-DEFAULT border border-line-strong bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-pretty text-sm font-medium text-ink">
            {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
          </p>
          <p className="text-pretty text-xs text-ink-muted">ปิดงวดเมื่อ {formatDate(period.closedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onToggleExpand}>
            {expanded ? "ซ่อนสรุป" : "ดูสรุป"}
          </Button>
          <a
            href={xlsxDownloadHref(branchId, period.id)}
            className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-sunk"
          >
            ดาวน์โหลด Excel
          </a>
          {canManage && (
            <Button variant="ghost" size="sm" onClick={onReopenClick}>
              เปิดงวดนี้ใหม่
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-line pt-3">
          {summaryQuery.isLoading && (
            <SkeletonGroup label="กำลังโหลดสรุป">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </SkeletonGroup>
          )}
          {summaryQuery.isError && (
            <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
              {summaryQuery.error instanceof ApiError ? summaryQuery.error.message : "โหลดสรุปไม่สำเร็จ กรุณาลองใหม่"}
              <Button variant="secondary" size="sm" className="ml-3" onClick={() => void summaryQuery.refetch()}>
                ลองใหม่
              </Button>
            </div>
          )}
          {summaryQuery.isSuccess && (
            <StaffSummaryTable summaries={summaryQuery.data.summaries} onPrint={onPrint} />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * หน้าค่ามือ/งวดจ่าย (T6.4) — โครงเดียวกับ CashierShiftPanel (T5.7): การ์ดงวดปัจจุบัน (เปิด/ปิด) +
 * ประวัติงวดที่ปิดแล้ว (ดูสรุป/ดาวน์โหลด Excel/เปิดใหม่ด้วย PIN ผู้จัดการ) ปุ่มจัดการทั้งหมดกันด้วย
 * payroll:manage — payroll:view เห็นได้อย่างเดียว
 */
export function PayrollPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "payroll");

  const currentKey = ["payroll-current", branch?.branchId];
  const listKey = ["payroll-periods", branch?.branchId];

  const currentQuery = useQuery({
    queryKey: currentKey,
    queryFn: () => payrollApi.current(branch!.branchId),
    enabled: !!branch?.branchId,
  });
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => payrollApi.list(branch!.branchId),
    enabled: !!branch?.branchId,
  });

  const [openError, setOpenError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closedResult, setClosedResult] = useState<{
    period: PayrollPeriod;
    summaries: PayrollPeriodStaffSummary[];
  } | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [payslipTarget, setPayslipTarget] = useState<{
    period: PayrollPeriod;
    summary: PayrollPeriodStaffSummary;
  } | null>(null);

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: currentKey });
    void queryClient.invalidateQueries({ queryKey: listKey });
  }

  const openMutation = useMutation({
    mutationFn: () => payrollApi.open(branch!.branchId),
    onSuccess: () => {
      setOpenError(null);
      invalidateAll();
    },
    onError: (err) => {
      setOpenError(err instanceof ApiError ? err.message : "เปิดงวดจ่ายไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  const closeMutation = useMutation({
    mutationFn: (periodId: string) => payrollApi.close(branch!.branchId, periodId),
    onSuccess: (period) => {
      setCloseError(null);
      setClosedResult({ period, summaries: period.summaries });
      invalidateAll();
    },
    onError: (err) => {
      setCloseError(err instanceof ApiError ? err.message : "ปิดงวดจ่ายไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ periodId, approvalToken }: { periodId: string; approvalToken: string }) =>
      payrollApi.reopen(branch!.branchId, periodId, approvalToken),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const current: PayrollPeriod | null = currentQuery.data?.period ?? null;
  const closedPeriods = (listQuery.data ?? []).filter((p) => p.closedAt !== null);

  if (!branch) {
    return (
      <div className="p-8">
        <p className="text-pretty rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-balance font-display text-2xl font-semibold text-ink">ค่ามือ</h1>
        <p className="text-pretty mt-1 text-sm text-ink-muted">เปิด/ปิดงวดจ่าย สรุปค่ามือ+ทิปต่อพนักงาน ที่สาขา {branch.branchName}</p>
      </div>

      {/* การ์ดงวดปัจจุบัน */}
      <div className="mb-6 rounded-DEFAULT border border-line-strong bg-surface p-4">
        {currentQuery.isLoading && (
          <Skeleton className="h-10" role="status" aria-busy="true" aria-label="กำลังโหลด" />
        )}

        {currentQuery.isError && (
          <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
            {currentQuery.error instanceof ApiError ? currentQuery.error.message : "โหลดงวดปัจจุบันไม่สำเร็จ กรุณาลองใหม่"}
            <Button variant="secondary" size="sm" className="ml-3" onClick={() => void currentQuery.refetch()}>
              ลองใหม่
            </Button>
          </div>
        )}

        {currentQuery.isSuccess && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-balance text-sm font-semibold text-ink">งวดจ่ายปัจจุบัน</h2>
                {current === null && (
                  <p className="text-pretty text-xs text-ink-muted">
                    ยังไม่มีงวดจ่ายที่เปิดอยู่{canManage ? " — กด \"เปิดงวดใหม่\" เพื่อเริ่ม" : ""}
                  </p>
                )}
                {current && <p className="text-pretty text-xs text-celadon">เปิดงวดอยู่ — เริ่มเมื่อ {formatDate(current.periodStart)}</p>}
              </div>
              <div className="flex gap-2">
                {canManage && current === null && (
                  <Button size="sm" disabled={openMutation.isPending} onClick={() => openMutation.mutate()}>
                    {openMutation.isPending ? "กำลังเปิด..." : "เปิดงวดใหม่"}
                  </Button>
                )}
                {canManage && current && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={closeMutation.isPending}
                    onClick={() => closeMutation.mutate(current.id)}
                  >
                    {closeMutation.isPending ? "กำลังปิด..." : "ปิดงวด"}
                  </Button>
                )}
              </div>
            </div>

            {openError && (
              <p role="alert" className="text-pretty mt-3 rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
                {openError}
              </p>
            )}
            {closeError && (
              <p role="alert" className="text-pretty mt-3 rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
                {closeError}
              </p>
            )}

            {closedResult && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="text-balance mb-2 text-sm font-semibold text-celadon">
                  ปิดงวดสำเร็จ — สรุปค่ามือของงวดนี้
                </h3>
                <StaffSummaryTable
                  summaries={closedResult.summaries}
                  onPrint={(summary) => setPayslipTarget({ period: closedResult.period, summary })}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ประวัติงวดที่ปิดแล้ว */}
      <section aria-label="ประวัติงวดจ่าย">
        <h2 className="text-balance mb-3 font-display text-lg font-semibold text-ink">ประวัติงวดจ่าย</h2>

        {listQuery.isLoading && (
          <SkeletonGroup label="กำลังโหลดประวัติงวดจ่าย">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </SkeletonGroup>
        )}

        {listQuery.isError && (
          <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
            {listQuery.error instanceof ApiError ? listQuery.error.message : "โหลดประวัติงวดจ่ายไม่สำเร็จ กรุณาลองใหม่"}
            <Button variant="secondary" size="sm" className="ml-3" onClick={() => void listQuery.refetch()}>
              ลองใหม่
            </Button>
          </div>
        )}

        {listQuery.isSuccess && closedPeriods.length === 0 && current === null && (
          <EmptyState
            title="ยังไม่มีงวดจ่ายเลย"
            description={canManage ? 'กด "เปิดงวดใหม่" ด้านบนเพื่อเริ่ม' : undefined}
          />
        )}

        {listQuery.isSuccess && closedPeriods.length === 0 && current !== null && (
          <EmptyState title="ยังไม่มีงวดที่ปิดแล้ว" description="ปิดงวดปัจจุบันเพื่อดูสรุปที่นี่" />
        )}

        {listQuery.isSuccess && closedPeriods.length > 0 && (
          <ul className="grid gap-3">
            {closedPeriods.map((period) => (
              <ClosedPeriodRow
                key={period.id}
                branchId={branch.branchId}
                period={period}
                canManage={canManage}
                expanded={expandedPeriodId === period.id}
                onToggleExpand={() => setExpandedPeriodId((prev) => (prev === period.id ? null : period.id))}
                onReopenClick={() => {
                  setReopenTargetId(period.id);
                  setPinDialogOpen(true);
                }}
                onPrint={(summary) => setPayslipTarget({ period, summary })}
              />
            ))}
          </ul>
        )}
      </section>

      <ManagerPinDialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        branchId={branch.branchId}
        title="ยืนยัน PIN ผู้จัดการเพื่อเปิดงวดจ่ายนี้ใหม่"
        description="งวดนี้ปิดไปแล้ว ต้องมีผู้จัดการหรือเจ้าของร้านกรอก PIN ก่อนเปิดใหม่ได้เสมอ"
        onApproved={(approvalToken) => {
          if (reopenTargetId) reopenMutation.mutate({ periodId: reopenTargetId, approvalToken });
          setPinDialogOpen(false);
          setReopenTargetId(null);
        }}
      />

      {payslipTarget && (
        <Payslip
          open
          onClose={() => setPayslipTarget(null)}
          branchName={branch.branchName}
          period={payslipTarget.period}
          summary={payslipTarget.summary}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import { reportsApi, staffApi } from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { downloadDailySummaryXlsx } from "./xlsx-export";
import { defaultDateRange } from "./date-utils";
import { RevenueChartSection } from "./revenue-chart-section";
import { PaymentBreakdownSection } from "./payment-breakdown-section";
import { StaffUtilizationSection } from "./staff-utilization-section";

/**
 * หน้ารายงาน (T7.4) — ตัวกรอง (from/to/staffId) sync สองทางกับ URL query string เสมอ: อ่านค่าเริ่มต้นจาก
 * useSearchParams ตอน mount, เขียนกลับด้วย router.replace ทุกครั้งที่ตัวกรองเปลี่ยน (ใช้ replace ไม่ใช่ push
 * เพราะไม่อยากให้ทุกการเปลี่ยนตัวกรองสร้างประวัติ back-button ใหม่) — ทำให้แชร์ URL แล้วเปิดได้ตัวกรองเดิม
 * ตามเกณฑ์ผ่านของ Task นี้ ไม่เหมือนหน้าสมาชิก (T7.3) ที่อ่านค่าเดียวจาก URL แต่ไม่เขียนกลับ (ADR-038)
 *
 * ดึงข้อมูล /daily-summary และ /staff-utilization ที่ระดับหน้านี้ (ไม่ใช่แยกต่อ section แบบแดชบอร์ด T7.3/
 * ADR-038) เพราะปุ่ม "ส่งออก CSV" กับกราฟ 2 ส่วนต้องใช้ข้อมูล daily-summary ชุดเดียวกันเป๊ะ — ส่ง query
 * result (react-query UseQueryResult) ลงไปให้แต่ละ section render เอง
 */
export function ReportsPageClient() {
  const branch = useCurrentBranch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults = defaultDateRange();
  const [from, setFrom] = useState(() => searchParams.get("from") ?? defaults.from);
  const [to, setTo] = useState(() => searchParams.get("to") ?? defaults.to);
  const [staffId, setStaffId] = useState(() => searchParams.get("staffId") ?? "");

  // เขียนตัวกรองปัจจุบันลง URL เสมอ (รวมตอน mount ครั้งแรกด้วย — ทำให้ /reports เปล่า ๆ ถูก normalize
  // เป็น /reports?from=...&to=... ทันที พร้อมแชร์ได้จากตรงนั้นเลย)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (staffId) params.set("staffId", staffId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, staffId]);

  const dailySummaryQuery = useQuery({
    queryKey: ["reports-daily-summary", branch?.branchId, from, to],
    queryFn: () => reportsApi.dailySummary(branch!.branchId, from, to),
    enabled: !!branch?.branchId && !!from && !!to,
  });

  const staffUtilizationQuery = useQuery({
    queryKey: ["reports-staff-utilization", branch?.branchId, from, to, staffId],
    queryFn: () => reportsApi.staffUtilization(branch!.branchId, from, to, staffId || undefined),
    enabled: !!branch?.branchId && !!from && !!to,
  });

  const staffListQuery = useQuery({
    queryKey: ["staff-list-for-reports", branch?.branchId],
    queryFn: () => staffApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const [isExporting, setIsExporting] = useState(false);

  async function handleExportXlsx() {
    const days = dailySummaryQuery.data?.days ?? [];
    setIsExporting(true);
    try {
      await downloadDailySummaryXlsx(`รายงาน-${from}-ถึง-${to}.xlsx`, days);
    } finally {
      setIsExporting(false);
    }
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

  const canExport = dailySummaryQuery.isSuccess && (dailySummaryQuery.data?.days.length ?? 0) > 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">รายงาน</h1>
          <p className="mt-1 text-sm text-ink-muted">ยอดขาย ช่องทางชำระ และชั่วโมงทำงานของสาขา {branch.branchName}</p>
        </div>
        <Button variant="secondary" onClick={handleExportXlsx} disabled={!canExport || isExporting}>
          {isExporting ? "กำลังสร้างไฟล์..." : "ส่งออก Excel"}
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-DEFAULT border border-line-strong bg-surface p-4">
        <div>
          <Label htmlFor="reports-from">จากวันที่</Label>
          <Input
            id="reports-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="reports-to">ถึงวันที่</Label>
          <Input
            id="reports-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="reports-staff">พนักงาน</Label>
          <Select
            id="reports-staff"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="mt-1"
          >
            <option value="">พนักงานทั้งหมด</option>
            {staffListQuery.data?.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChartSection query={dailySummaryQuery} />
        <PaymentBreakdownSection query={dailySummaryQuery} />
        <StaffUtilizationSection query={staffUtilizationQuery} />
      </div>
    </div>
  );
}

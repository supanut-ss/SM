"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import { ApiError, reportsApi } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-DEFAULT bg-surface-sunk p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-data text-lg tabular-nums text-ink">{value}</p>
    </div>
  );
}

/** KPI วันนี้ (T7.3) — คำนวณสดจาก ReportsController.today ทุกครั้งที่โหลดหน้า ไม่ cache นาน เพราะเป็นวันที่
 * ยังไม่ปิด ตัวเลขขยับได้ตลอดวัน */
export function KpiSection({ branchId }: { branchId: string }) {
  const todayQuery = useQuery({
    queryKey: ["reports-today", branchId],
    queryFn: () => reportsApi.today(branchId),
  });

  const data = todayQuery.data;
  const hasActivity =
    !!data &&
    (data.recognizedRevenueSatang !== 0 ||
      data.courseSoldCount !== 0 ||
      data.courseUsedCount !== 0 ||
      data.newCustomerCount !== 0 ||
      data.returningCustomerCount !== 0 ||
      data.noShowCount !== 0);

  return (
    <section aria-label="KPI วันนี้" className="rounded-DEFAULT border border-line-strong bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">KPI วันนี้</h2>
        <Link href="/billing">
          <Button variant="ghost" size="sm">
            ดูบิลวันนี้ →
          </Button>
        </Link>
      </div>

      {todayQuery.isLoading && (
        <SkeletonGroup
          label="กำลังโหลด KPI วันนี้"
          className="grid grid-cols-2 gap-3 space-y-0 sm:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </SkeletonGroup>
      )}

      {todayQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {todayQuery.error instanceof ApiError ? todayQuery.error.message : "โหลด KPI วันนี้ไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void todayQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {todayQuery.isSuccess && !hasActivity && (
        <div className="rounded-lg border border-dashed border-line-strong p-6 text-center">
          <p className="text-sm text-ink-muted">
            ยังไม่มีความเคลื่อนไหวในวันนี้ — ยอดจะขึ้นอัตโนมัติเมื่อมีบิลแรกของวันนี้
          </p>
        </div>
      )}

      {todayQuery.isSuccess && data && hasActivity && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="ยอดขายรับรู้" value={formatSatang(data.recognizedRevenueSatang)} />
          <StatTile label="เงินสดเข้า" value={formatSatang(data.cashInSatang)} />
          <StatTile
            label="คอร์สขายได้"
            value={`${data.courseSoldCount.toLocaleString("th-TH")} ใบ (${formatSatang(data.courseSoldValueSatang)})`}
          />
          <StatTile label="คอร์สที่ถูกตัดใช้" value={`${data.courseUsedCount.toLocaleString("th-TH")} ครั้ง`} />
          <StatTile
            label="ลูกค้าใหม่ / ลูกค้าเก่า"
            value={`${data.newCustomerCount.toLocaleString("th-TH")} / ${data.returningCustomerCount.toLocaleString("th-TH")}`}
          />
          <StatTile label="ไม่มาตามนัด (No-show)" value={`${data.noShowCount.toLocaleString("th-TH")} ครั้ง`} />
        </div>
      )}
    </section>
  );
}

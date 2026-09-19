"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton, SkeletonGroup, EmptyState } from "@lotus-desk/ui";
import { ApiError, reportsApi } from "../../../lib/api-client";

function formatDateThai(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/** ลูกค้าที่หายไปเกิน 60 วัน (T7.3) — ดึงจาก ReportsController.dormantCustomers (default daysSinceLastVisit=60) */
export function DormantCustomersSection({ branchId }: { branchId: string }) {
  const query = useQuery({
    queryKey: ["reports-customers-dormant", branchId],
    queryFn: () => reportsApi.dormantCustomers(branchId),
  });

  return (
    <section aria-label="ลูกค้าที่หายไปเกิน 60 วัน" className="rounded-DEFAULT border border-line-strong bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">ลูกค้าที่หายไปเกิน 60 วัน</h2>

      {query.isLoading && (
        <SkeletonGroup label="กำลังโหลดลูกค้าที่หายไป">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </SkeletonGroup>
      )}

      {query.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {query.error instanceof ApiError ? query.error.message : "โหลดลูกค้าที่หายไปไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void query.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <EmptyState className="p-6" title="ไม่มีสมาชิกที่หายไปเกิน 60 วัน — เยี่ยมมาก" />
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="grid gap-2">
          {query.data.map((row) => (
            <li key={row.member.id}>
              <Link
                href={`/members/${row.member.id}`}
                className="flex items-center justify-between gap-3 rounded-DEFAULT border border-line-strong bg-surface px-4 py-3 transition-colors hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{row.member.name}</p>
                  <p className="font-data text-xs tabular-nums text-ink-muted">{row.member.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-brass">หายไป {row.daysSinceLastVisit} วัน</p>
                  <p className="text-xs text-ink-faint">มาล่าสุด {formatDateThai(row.lastVisitAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

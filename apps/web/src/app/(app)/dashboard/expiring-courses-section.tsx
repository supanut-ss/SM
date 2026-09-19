"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton, SkeletonGroup, EmptyState } from "@lotus-desk/ui";
import { ApiError, reportsApi, type ExpiringCoursePackage } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDateThai(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatBalance(pkg: ExpiringCoursePackage): string {
  if (pkg.type === "SESSION_COUNT") return `เหลือ ${pkg.balance} / ${pkg.sessionCount} ครั้ง`;
  if (pkg.type === "VALUE")
    return `เหลือ ${formatSatang(pkg.balance)} / ${formatSatang(pkg.valueSatang ?? 0)}`;
  return "ไม่จำกัดจำนวนครั้ง";
}

/** คอร์สใกล้หมดอายุ (T7.3) — ดึงจาก ReportsController.coursesExpiring (default withinDays=30) */
export function ExpiringCoursesSection({ branchId }: { branchId: string }) {
  const query = useQuery({
    queryKey: ["reports-courses-expiring", branchId],
    queryFn: () => reportsApi.coursesExpiring(branchId),
  });

  // lazy initializer เรียกครั้งเดียวตอน mount ไม่ใช่ทุก render (React Compiler ห้ามเรียก Date.now() ตรง ๆ
  // ระหว่าง render — ดู react-hooks/purity, แพทเทิร์นเดียวกับ member-package-section.tsx)
  const [now] = useState(() => Date.now());

  return (
    <section
      aria-label="คอร์สใกล้หมดอายุ"
      className="rounded-DEFAULT border border-line-strong bg-surface p-4 sm:p-5"
    >
      <h2 className="text-balance mb-4 font-display text-lg font-semibold text-ink">
        คอร์สใกล้หมดอายุ
      </h2>

      {query.isLoading && (
        <SkeletonGroup label="กำลังโหลดคอร์สใกล้หมดอายุ">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </SkeletonGroup>
      )}

      {query.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {query.error instanceof ApiError
            ? query.error.message
            : "โหลดคอร์สใกล้หมดอายุไม่สำเร็จ กรุณาลองใหม่"}
          <Button
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => void query.refetch()}
          >
            ลองใหม่
          </Button>
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <EmptyState className="p-6" title="ไม่มีคอร์สที่ใกล้หมดอายุใน 30 วันนี้" />
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="grid gap-3">
          {query.data.map((pkg) => {
            const daysLeft = Math.ceil((new Date(pkg.expiresAt).getTime() - now) / MS_PER_DAY);
            return (
              <li key={pkg.id}>
                <Link
                  href={`/members/${pkg.memberId}`}
                  className="flex items-start justify-between gap-3 rounded-DEFAULT border border-line-strong bg-surface px-4 py-3 transition-colors hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
                >
                  <div>
                    <p className="text-pretty text-sm font-medium leading-6 text-ink">
                      {pkg.member.name} · {pkg.name}
                    </p>
                    <p className="text-pretty font-data text-xs tabular-nums text-ink-muted">
                      {formatBalance(pkg)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-pretty text-xs font-medium text-brass">
                      {daysLeft <= 0 ? "หมดอายุวันนี้" : `เหลืออีก ${daysLeft} วัน`}
                    </p>
                    <p className="text-pretty text-xs text-ink-faint">
                      {formatDateThai(pkg.expiresAt)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

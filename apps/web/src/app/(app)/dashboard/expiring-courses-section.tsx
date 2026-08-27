"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@lotus-desk/ui";
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
  if (pkg.type === "VALUE") return `เหลือ ${formatSatang(pkg.balance)} / ${formatSatang(pkg.valueSatang ?? 0)}`;
  return "ไม่จำกัดจำนวนครั้ง";
}

/** เพจสมาชิก (T3.x) ยังไม่มีเส้นทางลึกแบบ /members/[memberId] — ชีทแก้ไขเปิดจาก state ในหน้าเดียว และ
 * ช่องค้นหาไม่ได้ผูกกับ query param ของ URL จึงลิงก์ไปที่ /members?q=<รหัสสมาชิก> เป็นทางเลือกที่ดีที่สุด
 * ตอนนี้ (พาไปหน้าสมาชิกที่ถูกต้องจริง แต่ยังไม่ auto-filter ให้ — ดูรายงานท้ายงาน T7.3) */
function memberLink(code: string): string {
  return `/members?q=${encodeURIComponent(code)}`;
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
    <section aria-label="คอร์สใกล้หมดอายุ" className="rounded-DEFAULT border border-line-strong bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">คอร์สใกล้หมดอายุ</h2>

      {query.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดคอร์สใกล้หมดอายุ">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {query.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {query.error instanceof ApiError ? query.error.message : "โหลดคอร์สใกล้หมดอายุไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void query.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-6 text-center">
          <p className="text-sm text-ink-muted">ไม่มีคอร์สที่ใกล้หมดอายุใน 30 วันนี้</p>
        </div>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="grid gap-2">
          {query.data.map((pkg) => {
            const daysLeft = Math.ceil((new Date(pkg.expiresAt).getTime() - now) / MS_PER_DAY);
            return (
              <li key={pkg.id}>
                <Link
                  href={memberLink(pkg.member.code)}
                  className="flex items-center justify-between gap-3 rounded-DEFAULT border border-line-strong bg-surface px-4 py-3 transition-colors hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {pkg.member.name} · {pkg.name}
                    </p>
                    <p className="font-data text-xs tabular-nums text-ink-muted">{formatBalance(pkg)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-brass">
                      {daysLeft <= 0 ? "หมดอายุวันนี้" : `เหลืออีก ${daysLeft} วัน`}
                    </p>
                    <p className="text-xs text-ink-faint">{formatDateThai(pkg.expiresAt)}</p>
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

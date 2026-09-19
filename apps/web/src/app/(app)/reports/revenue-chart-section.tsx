"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Skeleton, EmptyState } from "@lotus-desk/ui";
import { ApiError, type DailySummaryReport } from "../../../lib/api-client";
import { formatDateShortThai } from "./date-utils";

/** สตางค์ → บาท (ตัวเลขล้วนสำหรับกราฟ ไม่ใช่ formatSatang ที่คืนสตริง "฿1,250" — Recharts ต้องการ number) */
function satangToBaht(satang: number): number {
  return satang / 100;
}

function formatBahtAxis(value: number): string {
  return value.toLocaleString("th-TH");
}

/** T7.4 ส่วนที่ 1 — กราฟรายได้รับรู้ vs เงินเข้าจริงต่อวัน คำศัพท์ตาม ADR-036 ("เงินเข้า vs รายได้รับรู้") */
export function RevenueChartSection({
  query,
}: {
  query: UseQueryResult<DailySummaryReport, unknown>;
}) {
  const days = query.data?.days ?? [];
  const chartData = days.map((day) => ({
    date: day.date.slice(0, 10),
    รายได้รับรู้: satangToBaht(day.recognizedRevenueSatang),
    เงินเข้าจริง: satangToBaht(day.cashInSatang),
  }));

  return (
    <section
      aria-label="กราฟรายได้และเงินเข้า"
      className="rounded-DEFAULT border border-line-strong bg-surface p-4 sm:p-5"
    >
      <h2 className="text-balance mb-4 font-display text-lg font-semibold text-ink">
        รายได้รับรู้ vs เงินเข้าจริง
      </h2>

      {query.isLoading && (
        <Skeleton
          className="h-64"
          role="status"
          aria-busy="true"
          aria-label="กำลังโหลดกราฟรายได้"
        />
      )}

      {query.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {query.error instanceof ApiError
            ? query.error.message
            : "โหลดกราฟรายได้ไม่สำเร็จ กรุณาลองใหม่"}
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

      {query.isSuccess && days.length === 0 && (
        <EmptyState
          className="flex h-64 flex-col items-center justify-center p-6"
          title="ไม่มีข้อมูลในช่วงที่เลือก"
          description="ลองขยายช่วงวันที่ให้กว้างขึ้น"
        />
      )}

      {query.isSuccess && days.length > 0 && (
        <div className="h-72 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShortThai}
                stroke="var(--ink-muted)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatBahtAxis}
                stroke="var(--ink-muted)"
                tick={{ fontSize: 12 }}
                width={64}
              />
              <Tooltip
                labelFormatter={(value) => formatDateShortThai(String(value))}
                formatter={(value) => `฿${Number(value).toLocaleString("th-TH")}`}
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  color: "var(--ink)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-muted)" }} />
              <Line
                type="monotone"
                dataKey="รายได้รับรู้"
                stroke="var(--celadon)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="เงินเข้าจริง"
                stroke="var(--indigo)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

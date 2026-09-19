"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@lotus-desk/contracts";
import { Button, Skeleton } from "@lotus-desk/ui";
import { ApiError, type DailySummaryReport } from "../../../lib/api-client";

// สีต่อช่องทางชำระ — ใช้ token ธรรมดา (ไม่ใช่ -solid) เพราะ -solid มีแค่ celadon/rose และตั้งใจไว้เฉพาะ
// พื้นทึบที่วางตัวอักษรขาวทับ (เช่น badge) เท่านั้น ดูคอมเมนต์ใน packages/ui/src/tokens.css — สำหรับจุดกราฟ/
// แท่ง/ชิ้นพาย เราต้องการโทนที่ปรับความสว่างตามธีมเหมือนกับตัวอักษร/เส้นขอบ จึงใช้ตัวแปรธรรมดา
// docs/DESIGN.md §3 มีแค่ 4 สีหลักตั้งชื่อไว้ (celadon/indigo/brass/rose) + สีกลาง ink-faint/ink-muted — ไม่มีสีที่ 5
// ให้ตั้งชื่อใหม่ ดังนั้น COMPLIMENTARY (รายการที่ไม่ใช่รายได้จริง ความสำคัญน้อยสุด) ใช้สีกลาง ink-faint แทน
// เปิดช่องให้ TRANSFER (รายได้จริง) ได้ใช้ rose ที่ COMPLIMENTARY เคยครองแทน — ห้ามเติมสี hex ใหม่เด็ดขาด (CLAUDE.md)
const PAYMENT_METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "var(--celadon)",
  PACKAGE: "var(--indigo)",
  VOUCHER: "var(--brass)",
  COMPLIMENTARY: "var(--ink-faint)",
  TRANSFER: "var(--rose)",
};

const PAYMENT_METHOD_TOTAL_FIELD: Record<PaymentMethod, keyof DailySummaryReport["totals"]> = {
  CASH: "paymentCashSatang",
  PACKAGE: "paymentPackageSatang",
  VOUCHER: "paymentVoucherSatang",
  COMPLIMENTARY: "paymentComplimentarySatang",
  TRANSFER: "paymentTransferSatang",
};

/** T7.4 ส่วนที่ 2 — สัดส่วนช่องทางชำระ รวมทั้งช่วงที่เลือก (จาก totals ที่ ReportsController คำนวณให้แล้ว) */
export function PaymentBreakdownSection({
  query,
}: {
  query: UseQueryResult<DailySummaryReport, unknown>;
}) {
  const totals = query.data?.totals;
  const chartData = totals
    ? (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[])
        .map((method) => ({
          method,
          name: PAYMENT_METHOD_LABEL[method],
          value: totals[PAYMENT_METHOD_TOTAL_FIELD[method]] / 100,
        }))
        .filter((row) => row.value > 0)
    : [];
  const hasData = chartData.length > 0;

  return (
    <section
      aria-label="สัดส่วนช่องทางชำระ"
      className="rounded-DEFAULT border border-line-strong bg-surface p-4"
    >
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">สัดส่วนช่องทางชำระ</h2>

      {query.isLoading && (
        <Skeleton className="h-64" role="status" aria-busy="true" aria-label="กำลังโหลดสัดส่วนช่องทางชำระ" />
      )}

      {query.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {query.error instanceof ApiError ? query.error.message : "โหลดสัดส่วนช่องทางชำระไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void query.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {query.isSuccess && !hasData && (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong p-6 text-center">
          <p className="text-sm text-ink-muted">ไม่มีข้อมูลในช่วงที่เลือก</p>
          <p className="text-xs text-ink-faint">ลองขยายช่วงวันที่ให้กว้างขึ้น</p>
        </div>
      )}

      {query.isSuccess && hasData && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {chartData.map((row) => (
                  <Cell key={row.method} fill={PAYMENT_METHOD_COLOR[row.method]} />
                ))}
              </Pie>
              <Tooltip
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
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

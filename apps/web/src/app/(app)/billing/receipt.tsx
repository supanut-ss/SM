"use client";

import { useState } from "react";
import { PAYMENT_METHOD_LABEL } from "@lotus-desk/contracts";
import { Button } from "@lotus-desk/ui";
import type { Bill } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * ใบเสร็จพิมพ์ 58/80mm (T5.6, เกณฑ์งานใน docs/PLAN.md) — ใช้เทคนิค CSS "print เฉพาะ element เดียว"
 * แบบเดียวกับใบคิว walk-in (T4.6, ดู walk-in-sheet.tsx) ความกว้างกระดาษเลือกได้ก่อนพิมพ์เพราะเครื่องพิมพ์
 * ใบเสร็จหน้าร้านมีทั้งสองขนาด ไม่รู้ล่วงหน้าว่าสาขาไหนใช้ขนาดไหน
 */
export function Receipt({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const [paperWidth, setPaperWidth] = useState<"58" | "80">("80");

  const changeSatang = bill.payments.reduce(
    (sum, p) => sum + (p.tenderedSatang !== null ? p.tenderedSatang - p.amountSatang : 0),
    0,
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex gap-2" role="group" aria-label="ขนาดกระดาษ">
          <Button
            type="button"
            variant={paperWidth === "58" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setPaperWidth("58")}
          >
            58mm
          </Button>
          <Button
            type="button"
            variant={paperWidth === "80" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setPaperWidth("80")}
          >
            80mm
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            ปิด
          </Button>
          <Button onClick={() => window.print()}>พิมพ์ใบเสร็จ</Button>
        </div>
      </div>

      <div
        id="bill-print-receipt"
        className="mx-auto grid gap-2 rounded-DEFAULT border border-line bg-surface p-4 font-data text-xs text-ink print:border-none print:p-0"
        style={{ width: paperWidth === "58" ? "58mm" : "80mm" }}
      >
        <p className="text-center font-display text-sm font-semibold">Lotus Desk</p>
        <p className="text-center text-ink-muted">ใบเสร็จรับเงิน</p>
        <div className="flex justify-between">
          <span>เลขที่บิล</span>
          <span>{bill.billNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>วันที่</span>
          <span>{formatDateTime(bill.createdAt)}</span>
        </div>

        {bill.status === "CANCELLED" && (
          <p className="text-center font-semibold text-rose">** บิลนี้ถูกยกเลิกแล้ว **</p>
        )}

        <div className="grid gap-1 border-t border-dashed border-line-strong pt-2">
          {bill.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-2">
              <span className="flex-1">
                {line.description}
                {line.quantity > 1 ? ` x${line.quantity}` : ""}
              </span>
              <span className="tabular-nums">{formatSatang(line.priceSatang * line.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-1 border-t border-dashed border-line-strong pt-2">
          <div className="flex justify-between">
            <span>ยอดรวม</span>
            <span className="tabular-nums">{formatSatang(bill.subtotalSatang)}</span>
          </div>
          {bill.discountSatang > 0 && (
            <div className="flex justify-between">
              <span>ส่วนลด</span>
              <span className="tabular-nums">-{formatSatang(bill.discountSatang)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>ยอดสุทธิ</span>
            <span className="tabular-nums">{formatSatang(bill.totalSatang)}</span>
          </div>
        </div>

        <div className="grid gap-1 border-t border-dashed border-line-strong pt-2">
          {bill.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{PAYMENT_METHOD_LABEL[p.method]}</span>
              <span className="tabular-nums">{formatSatang(p.amountSatang)}</span>
            </div>
          ))}
          {changeSatang > 0 && (
            <div className="flex justify-between text-ink-muted">
              <span>เงินทอน</span>
              <span className="tabular-nums">{formatSatang(changeSatang)}</span>
            </div>
          )}
        </div>

        <p className="mt-2 text-center text-ink-muted">ขอบคุณที่ใช้บริการ</p>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bill-print-receipt, #bill-print-receipt * { visibility: visible; }
          #bill-print-receipt {
            position: fixed;
            top: 0;
            left: 0;
          }
          @page { margin: 4mm; }
        }
      `}</style>
    </div>
  );
}

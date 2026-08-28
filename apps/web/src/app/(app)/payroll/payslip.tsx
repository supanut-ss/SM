"use client";

import { STAFF_LEVEL_LABEL } from "@lotus-desk/contracts";
import { Button, Sheet } from "@lotus-desk/ui";
import type { PayrollPeriod, PayrollPeriodStaffSummary } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * สลิปค่ามือรายบุคคล พิมพ์ได้ (T6.4) — ใช้เทคนิคเดียวกับ Receipt (billing/receipt.tsx): CSS
 * "print เฉพาะ element เดียว" (`body * { visibility: hidden }` แล้วเปิด visibility เฉพาะ id นี้)
 * ต่างจากใบเสร็จตรงที่สลิปนี้เป็นเอกสารทั่วไป ไม่ใช่กระดาษความร้อน จึงไม่มีตัวเลือกความกว้าง 58/80mm
 * — พิมพ์ตามขนาดกระดาษ default ของเบราว์เซอร์ ห่อด้วย Sheet (แผงเลื่อนจากขวา) เพื่อได้ focus
 * trap/Escape/คืน focus ฟรีจาก component ที่มีอยู่แล้ว โดยไม่ซ้อนกับ Sheet อื่น (ปุ่มเปิดสลิปอยู่ในหน้า
 * หลัก ไม่ได้อยู่ใน ManagerPinDialog ดู docs/DESIGN.md §3.5 "ห้าม modal ซ้อน modal")
 */
export function Payslip({
  open,
  onClose,
  branchName,
  period,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  branchName: string;
  period: PayrollPeriod;
  summary: PayrollPeriodStaffSummary;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="สลิปค่ามือ" description={summary.staff.name}>
      <div className="grid gap-4">
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()}>พิมพ์สลิป</Button>
        </div>

        <div
          id="payroll-print-payslip"
          className="grid gap-3 rounded-DEFAULT border border-line bg-surface p-5 text-sm text-ink print:border-none"
        >
          <div className="text-center">
            <p className="font-display text-base font-semibold">{branchName}</p>
            <p className="text-ink-muted">สลิปค่ามือ</p>
            <p className="mt-1 text-xs text-ink-muted">
              งวด {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
            </p>
          </div>

          <div className="grid gap-1 border-t border-dashed border-line-strong pt-3">
            <div className="flex justify-between">
              <span className="text-ink-muted">พนักงาน</span>
              <span className="font-medium">{summary.staff.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">ระดับ</span>
              <span>{STAFF_LEVEL_LABEL[summary.staff.level]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">จำนวนใบงาน</span>
              <span className="font-data tabular-nums">{summary.jobCount}</span>
            </div>
          </div>

          <div className="grid gap-1 border-t border-dashed border-line-strong pt-3">
            <div className="flex justify-between">
              <span>ค่ามือ</span>
              <span className="font-data tabular-nums">{formatSatang(summary.commissionSatang)}</span>
            </div>
            <div className="flex justify-between">
              <span>ทิป</span>
              <span className="font-data tabular-nums">{formatSatang(summary.tipSatang)}</span>
            </div>
            <div className="flex justify-between">
              <span>หัก</span>
              <span className="font-data tabular-nums">-{formatSatang(summary.deductionSatang)}</span>
            </div>
            <div className="flex justify-between border-t border-line-strong pt-1 font-semibold">
              <span>รวมสุทธิ</span>
              <span className="font-data tabular-nums">{formatSatang(summary.totalSatang)}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payroll-print-payslip, #payroll-print-payslip * { visibility: visible; }
          #payroll-print-payslip {
            position: fixed;
            top: 0;
            left: 0;
          }
          @page { margin: 12mm; }
        }
      `}</style>
    </Sheet>
  );
}

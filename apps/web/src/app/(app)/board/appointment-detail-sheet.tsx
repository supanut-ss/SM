"use client";

import { useState } from "react";
import {
  APPOINTMENT_STATUS_LABEL,
  ASSIGN_TYPE_LABEL,
  nextAppointmentStatuses,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
} from "@lotus-desk/contracts";
import type { AppointmentStatus, PaymentMethod } from "@lotus-desk/contracts";
import { Button, Select, Sheet } from "@lotus-desk/ui";
import type { AppointmentItem } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * เปิดด้วย Enter/ดับเบิลคลิกบนบล็อกใน Lane Board (T4.5) — ดูรายละเอียด + เปลี่ยนสถานะได้ตรงนี้
 * เปลี่ยนเป็น "เสร็จแล้ว" (COMPLETED) ต้องเลือกแหล่งชำระก่อนเสมอ (ตัดสินใจตอนจบงาน ไม่ใช่ตอนเริ่ม —
 * ดู docs/decisions.md ADR-029) ใบงาน (ServiceJob, T5.5) แสดงราคา/ค่ามือ snapshot ถ้ามีแล้ว
 */
export function AppointmentDetailSheet({
  item,
  onClose,
  canManage,
  onChangeStatus,
  isPending,
}: {
  item: AppointmentItem | null;
  onClose: () => void;
  canManage: boolean;
  onChangeStatus: (item: AppointmentItem, status: AppointmentStatus, paymentMethod?: PaymentMethod) => void;
  isPending: boolean;
}) {
  const [choosingPayment, setChoosingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const nextStatuses = item ? nextAppointmentStatuses(item.status) : [];

  function handleClose() {
    setChoosingPayment(false);
    onClose();
  }

  function clickStatus(status: AppointmentStatus) {
    if (!item) return;
    if (status === "COMPLETED") {
      setChoosingPayment(true);
      return;
    }
    onChangeStatus(item, status);
  }

  return (
    <Sheet
      open={!!item}
      onClose={handleClose}
      title={item ? (item.appointment.member?.name ?? "ลูกค้า Walk-in") : ""}
    >
      {item && (
        <div className="grid gap-4">
          <div className="grid gap-1.5 rounded-DEFAULT border border-line p-3">
            <Row label="บริการ" value={item.serviceVariant.service.name} />
            <Row label="พนักงาน" value={item.staff.name} />
            <Row label="ห้อง" value={item.room.name} />
            <Row label="เวลา" value={`${formatTime(item.startAt)}–${formatTime(item.endAt)}`} />
            <Row label="สถานะ" value={APPOINTMENT_STATUS_LABEL[item.status]} />
            <Row label="ที่มา" value={ASSIGN_TYPE_LABEL[item.assignType]} />
            {item.appointment.note && <Row label="บันทึก" value={item.appointment.note} />}
          </div>

          {item.serviceJob && (
            <div className="grid gap-1.5 rounded-DEFAULT border border-line p-3">
              <span className="text-xs font-medium text-ink-muted">ใบงาน</span>
              <Row label="เริ่มงาน" value={formatTime(item.serviceJob.startedAt)} />
              {item.serviceJob.completedAt && <Row label="จบงาน" value={formatTime(item.serviceJob.completedAt)} />}
              <Row label="ราคา (ตอนเริ่มงาน)" value={formatSatang(item.serviceJob.priceSatang)} />
              <Row label="ค่ามือ" value={formatSatang(item.serviceJob.commissionSatang)} />
              {item.serviceJob.paymentMethod && (
                <Row label="แหล่งชำระ" value={PAYMENT_METHOD_LABEL[item.serviceJob.paymentMethod]} />
              )}
            </div>
          )}

          {canManage && (
            <div className="grid gap-2 border-t border-line pt-4">
              <span className="text-xs font-medium text-ink-muted">เปลี่ยนสถานะ</span>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => clickStatus(status)}
                  >
                    {APPOINTMENT_STATUS_LABEL[status]}
                  </Button>
                ))}
                {nextStatuses.length === 0 && (
                  <span className="text-xs text-ink-faint">สถานะนี้เปลี่ยนต่อไม่ได้แล้ว</span>
                )}
              </div>

              {choosingPayment && (
                <div className="grid gap-2 rounded-DEFAULT border border-line p-3">
                  <span className="text-xs font-medium text-ink-muted">เลือกแหล่งชำระก่อนปิดงาน</span>
                  <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setChoosingPayment(false)}>
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        onChangeStatus(item, "COMPLETED", paymentMethod);
                        setChoosingPayment(false);
                      }}
                    >
                      ยืนยันจบงาน
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

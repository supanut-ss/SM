"use client";

import { APPOINTMENT_STATUS_LABEL, ASSIGN_TYPE_LABEL, nextAppointmentStatuses } from "@lotus-desk/contracts";
import type { AppointmentStatus } from "@lotus-desk/contracts";
import { Button, Sheet } from "@lotus-desk/ui";
import type { AppointmentItem } from "../../../lib/api-client";

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

/** เปิดด้วย Enter/ดับเบิลคลิกบนบล็อกใน Lane Board (T4.5) — ดูรายละเอียด + เปลี่ยนสถานะได้ตรงนี้ */
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
  onChangeStatus: (item: AppointmentItem, status: AppointmentStatus) => void;
  isPending: boolean;
}) {
  const nextStatuses = item ? nextAppointmentStatuses(item.status) : [];

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
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
                    onClick={() => onChangeStatus(item, status)}
                  >
                    {APPOINTMENT_STATUS_LABEL[status]}
                  </Button>
                ))}
                {nextStatuses.length === 0 && (
                  <span className="text-xs text-ink-faint">สถานะนี้เปลี่ยนต่อไม่ได้แล้ว</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

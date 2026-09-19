"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Sheet, Skeleton } from "@lotus-desk/ui";
import { ApiError, appointmentItemApi, serviceApi, type AppointmentItem } from "../../../lib/api-client";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * จองด่วนจากคิวหมุน (T4.6) — เกณฑ์ผ่าน "จองลูกค้าเดินเข้าเสร็จใน ≤ 4 คลิก": เปิดชีท (1) → เลือกบริการ
 * (2, สร้างนัด+เช็คอินทันทีในคลิกเดียว) → พิมพ์ใบคิว (3, ไม่บังคับ) → ปิด (4, ไม่บังคับ) ไม่ต้องเลือก
 * พนักงาน/ห้อง/ลูกค้าเอง (ระบบเลือกจากคิวหมุน+ความว่างให้ ดู docs/decisions.md ADR-024)
 *
 * พิมพ์ใบคิวด้วยเทคนิค CSS มาตรฐาน "print เฉพาะ element เดียว" (ซ่อนทั้งหน้าด้วย visibility:hidden ตอน
 * print แล้วเปิดเฉพาะ #walk-in-print-ticket) ไม่ต้องแก้ AppShell/Sidebar/Topbar เลย
 */
export function WalkInSheet({
  open,
  onClose,
  branchId,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
  onBooked: () => void;
}) {
  const [created, setCreated] = useState<AppointmentItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services", branchId, "", "true"],
    queryFn: () => serviceApi.list(branchId, { isActive: "true" }),
    enabled: open,
  });

  const walkInMutation = useMutation({
    mutationFn: (serviceVariantId: string) =>
      appointmentItemApi.createWalkIn(branchId, { serviceVariantId }),
    onSuccess: (item) => {
      setCreated(item);
      setError(null);
      onBooked();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "จองด่วนไม่สำเร็จ กรุณาลองใหม่"),
  });

  function handleClose() {
    setCreated(null);
    setError(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={handleClose} title="จองด่วนจากคิวหมุน">
      {!created && (
        <div className="grid gap-4">
          <p className="text-pretty text-sm text-ink-muted">
            เลือกบริการ — ระบบจะเลือกพนักงานและห้องที่ว่างให้เองจากคิวหมุน แล้วเช็คอินให้ทันที
          </p>
          {error && (
            <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}
          {servicesQuery.isLoading && (
            <Skeleton className="h-9 w-full" role="status" aria-label="กำลังโหลด" />
          )}
          {servicesQuery.isSuccess && servicesQuery.data.length === 0 && (
            <p className="text-pretty text-sm text-ink-muted">ยังไม่มีบริการที่เปิดขายในสาขานี้</p>
          )}
          <div className="grid gap-2">
            {(servicesQuery.data ?? []).flatMap((service) =>
              service.variants
                .filter((v) => v.isActive)
                .map((variant) => (
                  <Button
                    key={variant.id}
                    variant="secondary"
                    disabled={walkInMutation.isPending}
                    onClick={() => walkInMutation.mutate(variant.id)}
                    className="justify-between"
                  >
                    <span>
                      {service.name} · {variant.durationMin} นาที
                    </span>
                  </Button>
                )),
            )}
          </div>
        </div>
      )}

      {created && (
        <div className="grid gap-4">
          <div
            id="walk-in-print-ticket"
            className="grid gap-2 rounded-DEFAULT border border-line p-4 print:border-none print:p-0"
          >
            <p className="text-pretty text-center font-display text-lg font-semibold text-ink">ใบคิว</p>
            <TicketRow
              label="ลูกค้า"
              value={created.appointment.member?.name ?? "ลูกค้า Walk-in"}
            />
            <TicketRow label="บริการ" value={created.serviceVariant.service.name} />
            <TicketRow label="พนักงาน" value={created.staff.name} />
            <TicketRow label="ห้อง" value={created.room.name} />
            <TicketRow label="เวลา" value={formatTime(created.startAt)} />
          </div>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="ghost" onClick={handleClose}>
              เสร็จสิ้น
            </Button>
            <Button onClick={() => window.print()}>พิมพ์ใบคิว</Button>
          </div>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #walk-in-print-ticket, #walk-in-print-ticket * { visibility: visible; }
              #walk-in-print-ticket {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
              }
            }
          `}</style>
        </div>
      )}
    </Sheet>
  );
}

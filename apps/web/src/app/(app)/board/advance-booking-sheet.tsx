"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ADVANCE_BOOKING_MAX_DAYS } from "@lotus-desk/contracts";
import { Button, Select, Sheet, Skeleton } from "@lotus-desk/ui";
import {
  ApiError,
  appointmentItemApi,
  memberApi,
  roomApi,
  serviceApi,
  staffApi,
  type AppointmentItem,
} from "../../../lib/api-client";
import { bangkokInstant, toDateKey } from "./date-format";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * จองล่วงหน้า (T4.7) — ต่างจากจองด่วน (WalkInSheet) ตรงที่ผู้ใช้เลือกวัน/เวลา/พนักงาน/ห้องเอง แทนที่ระบบจะ
 * เลือกให้จากคิวหมุน รับจองล่วงหน้าได้สูงสุด ADVANCE_BOOKING_MAX_DAYS วัน (ดู docs/DOMAIN.md ข้อ 4,
 * docs/decisions.md ADR-058) เพิ่มขึ้นมาเพราะเดิมระบบมีแค่ "จองด่วนวันนี้" กับ "ลาก-วางบนกระดาน" (เดสก์ท็อป
 * เท่านั้น) ไม่มีทางสร้างนัดล่วงหน้าได้เลยไม่ว่าอุปกรณ์ไหน
 */
export function AdvanceBookingSheet({
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
  const [memberQuery, setMemberQuery] = useState("");
  const [debouncedMemberQuery, setDebouncedMemberQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [serviceVariantId, setServiceVariantId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [dateValue, setDateValue] = useState(() => toDateKey(new Date()));
  const [timeValue, setTimeValue] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  // ใช้ useState(() => ...) แทนเรียกตรง ๆ ตอน render — Date.now()/new Date() impure ต้องกันไม่ให้รันซ้ำ
  // ทุกครั้งที่ re-render (react-hooks/purity) ค่านี้ไม่จำเป็นต้องอัปเดตระหว่างที่ชีทเปิดค้างอยู่อยู่แล้ว
  const [minDate] = useState(() => toDateKey(new Date()));
  const [maxDate] = useState(() =>
    toDateKey(new Date(Date.now() + ADVANCE_BOOKING_MAX_DAYS * 24 * 60 * 60 * 1000)),
  );

  const servicesQuery = useQuery({
    queryKey: ["services", branchId, "", "true"],
    queryFn: () => serviceApi.list(branchId, { isActive: "true" }),
    enabled: open,
  });
  const staffQuery = useQuery({
    queryKey: ["staff", branchId, "", "true"],
    queryFn: () => staffApi.list(branchId, { isActive: "true" }),
    enabled: open,
  });
  const roomsQuery = useQuery({
    queryKey: ["rooms", branchId, "", "true"],
    queryFn: () => roomApi.list(branchId, { isActive: "true" }),
    enabled: open,
  });
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMemberQuery(memberQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [memberQuery]);

  const membersQuery = useQuery({
    queryKey: ["members", branchId, debouncedMemberQuery],
    queryFn: () => memberApi.list(branchId, { q: debouncedMemberQuery, isActive: "true" }),
    enabled: open && debouncedMemberQuery.length >= 2,
  });

  const variants = useMemo(
    () =>
      (servicesQuery.data ?? []).flatMap((service) =>
        service.variants
          .filter((v) => v.isActive)
          .map((v) => ({ ...v, serviceName: service.name })),
      ),
    [servicesQuery.data],
  );
  const selectedVariant = variants.find((v) => v.id === serviceVariantId) ?? null;

  // กรองเฉพาะคนที่มีทักษะ/ห้องที่ตรงกับบริการที่เลือกไว้ — backend เช็คซ้ำอีกชั้นอยู่แล้ว แต่กรองให้ก่อน
  // กันเลือกแล้วโดนปฏิเสธ 422 เปล่า ๆ
  const eligibleStaff = selectedVariant
    ? (staffQuery.data ?? []).filter((s) => s.skills.includes(selectedVariant.requiredSkill))
    : (staffQuery.data ?? []);
  const eligibleRooms = selectedVariant
    ? (roomsQuery.data ?? []).filter((r) => r.roomTypeId === selectedVariant.requiredRoomTypeId)
    : (roomsQuery.data ?? []);

  const advanceMutation = useMutation({
    mutationFn: () => {
      const [hour, minute] = timeValue.split(":").map(Number);
      const startAt = bangkokInstant(dateValue, hour!, minute);
      return appointmentItemApi.createAdvance(branchId, {
        serviceVariantId,
        staffId,
        roomId,
        startAt,
        memberId: memberId || undefined,
      });
    },
    onSuccess: (item: AppointmentItem) => {
      setError(null);
      onBooked();
      handleClose(item);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "จองล่วงหน้าไม่สำเร็จ กรุณาลองใหม่"),
  });

  const [confirmed, setConfirmed] = useState<AppointmentItem | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  function handleClose(next: AppointmentItem | null = null) {
    if (next) {
      setConfirmed(next);
      return;
    }
    setConfirmed(null);
    setConfirmingClose(false);
    setMemberQuery("");
    setDebouncedMemberQuery("");
    setMemberId("");
    setServiceVariantId("");
    setStaffId("");
    setRoomId("");
    setDateValue(toDateKey(new Date()));
    setTimeValue("10:00");
    setError(null);
    onClose();
  }

  // มีข้อมูลที่กรอกไว้แล้วหรือยัง — ปิดชีทตรง ๆ ถ้ายังไม่กรอกอะไรเลย ถามยืนยันก่อนถ้ามีข้อมูลจะหาย (จองสำเร็จ
  // แล้ว/ยังไม่ได้กรอกอะไรเลย ไม่ต้องถาม เพราะไม่มีอะไรจะเสีย)
  const hasUnsavedInput =
    !confirmed && (!!memberQuery.trim() || !!serviceVariantId || !!staffId || !!roomId);

  function requestClose() {
    if (hasUnsavedInput) {
      setConfirmingClose(true);
      return;
    }
    handleClose();
  }

  const canSubmit = !!serviceVariantId && !!staffId && !!roomId && !!dateValue && !!timeValue;

  return (
    <Sheet open={open} onClose={requestClose} title="จองคิวล่วงหน้า">
      {confirmingClose && (
        <div className="grid gap-4">
          <p className="text-pretty rounded-DEFAULT border border-line bg-rose-tint px-3 py-2 text-sm text-ink">
            ข้อมูลที่กรอกไว้จะหายไปทั้งหมดถ้าปิดตอนนี้ — ยืนยันปิดเลยไหม?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmingClose(false)}>
              กลับไปกรอกต่อ
            </Button>
            <Button variant="secondary" onClick={() => handleClose()}>
              ยืนยันปิด
            </Button>
          </div>
        </div>
      )}

      {!confirmingClose && !confirmed && (
        <div className="grid gap-4">
          <p className="text-pretty text-sm text-ink-muted">
            เลือกบริการ พนักงาน ห้อง วันและเวลาที่ต้องการเอง — รับจองล่วงหน้าได้ไม่เกิน{" "}
            {ADVANCE_BOOKING_MAX_DAYS} วัน
          </p>
          {error && (
            <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}

          <div className="grid gap-1.5">
            <label htmlFor="advance-member-search" className="text-xs font-medium text-ink-muted">
              สมาชิก (ไม่บังคับ — เว้นว่างได้ถ้าเป็นลูกค้า walk-in)
            </label>
            <input
              id="advance-member-search"
              type="search"
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                setMemberId("");
              }}
              placeholder="พิมพ์ชื่อหรือเบอร์โทรอย่างน้อย 2 ตัวอักษร..."
              className="h-11 w-full rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
            />
            {membersQuery.isLoading && <Skeleton className="h-9 w-full" role="status" aria-label="กำลังค้นหา" />}
            {membersQuery.isSuccess && debouncedMemberQuery.length >= 2 && (
              <Select
                aria-label="เลือกสมาชิก"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">-- ไม่ผูกกับสมาชิก (walk-in) --</option>
                {membersQuery.data!.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.phone ?? "ไม่มีเบอร์"}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="advance-service" className="text-xs font-medium text-ink-muted">
              บริการ
            </label>
            {servicesQuery.isLoading && <Skeleton className="h-9 w-full" role="status" aria-label="กำลังโหลด" />}
            <Select
              id="advance-service"
              aria-label="เลือกบริการ"
              value={serviceVariantId}
              onChange={(e) => {
                setServiceVariantId(e.target.value);
                setStaffId("");
                setRoomId("");
              }}
            >
              <option value="" disabled>
                -- เลือกบริการ --
              </option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.serviceName} · {v.durationMin} นาที
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="advance-date" className="text-xs font-medium text-ink-muted">
                วันที่
              </label>
              <input
                id="advance-date"
                type="date"
                min={minDate}
                max={maxDate}
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="advance-time" className="text-xs font-medium text-ink-muted">
                เวลาเริ่ม
              </label>
              <input
                id="advance-time"
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="advance-staff" className="text-xs font-medium text-ink-muted">
              พนักงาน
            </label>
            <Select
              id="advance-staff"
              aria-label="เลือกพนักงาน"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              disabled={!serviceVariantId}
            >
              <option value="" disabled>
                {serviceVariantId ? "-- เลือกพนักงาน --" : "-- เลือกบริการก่อน --"}
              </option>
              {eligibleStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {serviceVariantId && eligibleStaff.length === 0 && (
              <p className="text-pretty text-xs text-brass">ไม่มีพนักงานที่มีทักษะตรงกับบริการนี้</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="advance-room" className="text-xs font-medium text-ink-muted">
              ห้อง
            </label>
            <Select
              id="advance-room"
              aria-label="เลือกห้อง"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={!serviceVariantId}
            >
              <option value="" disabled>
                {serviceVariantId ? "-- เลือกห้อง --" : "-- เลือกบริการก่อน --"}
              </option>
              {eligibleRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            {serviceVariantId && eligibleRooms.length === 0 && (
              <p className="text-pretty text-xs text-brass">ไม่มีห้องที่รองรับบริการนี้</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={requestClose}>
              ยกเลิก
            </Button>
            <Button
              disabled={!canSubmit || advanceMutation.isPending}
              onClick={() => advanceMutation.mutate()}
            >
              ยืนยันจอง
            </Button>
          </div>
        </div>
      )}

      {confirmed && (
        <div className="grid gap-4">
          <p className="text-pretty rounded-DEFAULT border border-line bg-celadon-tint px-3 py-2 text-sm text-ink">
            จองสำเร็จแล้ว — {confirmed.appointment.member?.name ?? "ลูกค้า Walk-in"} กับ{" "}
            {confirmed.staff.name} วันที่ {formatDateTime(confirmed.startAt)}
          </p>
          <div className="flex justify-end">
            <Button onClick={() => handleClose()}>เสร็จสิ้น</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

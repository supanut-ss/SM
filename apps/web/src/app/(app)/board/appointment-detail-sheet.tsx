"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  APPOINTMENT_STATUS_LABEL,
  ASSIGN_TYPE_LABEL,
  nextAppointmentStatuses,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
} from "@lotus-desk/contracts";
import type { AppointmentStatus, PaymentMethod } from "@lotus-desk/contracts";
import { Button, Select, Sheet } from "@lotus-desk/ui";
import { memberPackageApi, type AppointmentItem } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { useCurrentBranch } from "../current-branch-context";

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
 * เปลี่ยนเป็น "เริ่มงาน" (IN_SERVICE) ต้องเลือกแหล่งชำระ (+ คอร์สที่จะตัดถ้าเลือกจ่ายด้วยคอร์ส) ก่อนเสมอ
 * (ตัดสินใจตอนเริ่มงาน ไม่ใช่ตอนจบงานอีกต่อไป — ดู docs/decisions.md ADR-046 ที่พลิกกลับ ADR-029) การตัด
 * ยอดคอร์สจริงยังเกิดตอน checkout เหมือนเดิม ที่นี่แค่ตรวจสิทธิ์ล่วงหน้า+ล็อกไว้ว่าจะตัดใบไหน — เปลี่ยนเป็น
 * "จบงาน" (COMPLETED) ไม่มีอะไรให้เลือกอีกแล้ว ใบงาน (ServiceJob, T5.5) แสดงราคา/ค่ามือ snapshot ถ้ามีแล้ว
 */
export function AppointmentDetailSheet({
  item,
  onClose,
  canManage,
  onChangeStatus,
  isPending,
  errorMessage,
}: {
  item: AppointmentItem | null;
  onClose: () => void;
  canManage: boolean;
  onChangeStatus: (
    item: AppointmentItem,
    status: AppointmentStatus,
    paymentMethod?: PaymentMethod,
    memberPackageId?: string,
  ) => void;
  isPending: boolean;
  /** ข้อความ error จาก backend (เช่น validateUse() ปฏิเสธตอนเริ่มงานเพราะยอดคอร์สไม่พอ) — แสดงให้เห็นชัด ๆ
   * ไม่ปล่อยให้เงียบ */
  errorMessage?: string | null;
}) {
  const branch = useCurrentBranch();
  const [choosingPayment, setChoosingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [memberPackageId, setMemberPackageId] = useState("");
  const nextStatuses = item ? nextAppointmentStatuses(item.status) : [];
  const memberId = item?.appointment.memberId ?? null;

  const memberPackagesQuery = useQuery({
    queryKey: ["member-packages", branch?.branchId, memberId],
    queryFn: () => memberPackageApi.list(branch!.branchId, memberId!),
    enabled: !!branch?.branchId && !!memberId && choosingPayment && paymentMethod === "PACKAGE",
  });

  const availablePaymentMethods = memberId ? PAYMENT_METHODS : PAYMENT_METHODS.filter((m) => m !== "PACKAGE");
  const eligiblePackages = item
    ? (memberPackagesQuery.data ?? []).filter(
        (pkg) =>
          pkg.status === "ACTIVE" &&
          (pkg.type === "VALUE" || pkg.serviceVariantId === item.serviceVariantId) &&
          (pkg.type === "UNLIMITED_DURATION" || pkg.balance > 0),
      )
    : [];

  function handleClose() {
    setChoosingPayment(false);
    setPaymentMethod("CASH");
    setMemberPackageId("");
    onClose();
  }

  function clickStatus(status: AppointmentStatus) {
    if (!item) return;
    if (status === "IN_SERVICE") {
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
              {item.serviceJob.paymentMethod === "PACKAGE" && (
                <Row
                  label="ตัดคอร์ส"
                  value={item.serviceJob.memberPackage?.name ?? "เลือกไว้ตอนเริ่มงาน"}
                />
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
                    {status === "COMPLETED" ? "จบงาน" : APPOINTMENT_STATUS_LABEL[status]}
                  </Button>
                ))}
                {nextStatuses.length === 0 && (
                  <span className="text-xs text-ink-faint">สถานะนี้เปลี่ยนต่อไม่ได้แล้ว</span>
                )}
              </div>

              {errorMessage && (
                <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
                  {errorMessage}
                </p>
              )}

              {choosingPayment && (
                <div className="grid gap-2 rounded-DEFAULT border border-line p-3">
                  <span className="text-xs font-medium text-ink-muted">เลือกแหล่งชำระก่อนเริ่มงาน</span>
                  <Select
                    aria-label="แหล่งชำระ"
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value as PaymentMethod);
                      setMemberPackageId("");
                    }}
                  >
                    {availablePaymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                  {!memberId && (
                    <p className="text-xs text-ink-faint">นัดนี้ไม่มีสมาชิกผูกอยู่ จ่ายด้วยคอร์สไม่ได้</p>
                  )}

                  {paymentMethod === "PACKAGE" && (
                    <div className="grid gap-1">
                      {memberPackagesQuery.isLoading && (
                        <p className="text-xs text-ink-muted">กำลังโหลดคอร์สของสมาชิก...</p>
                      )}
                      {memberPackagesQuery.isError && (
                        <p className="text-xs text-rose">
                          โหลดคอร์สของสมาชิกไม่สำเร็จ —{" "}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => void memberPackagesQuery.refetch()}
                          >
                            ลองใหม่
                          </button>
                        </p>
                      )}
                      {memberPackagesQuery.isSuccess && eligiblePackages.length === 0 && (
                        <p className="text-xs text-brass">สมาชิกคนนี้ไม่มีคอร์สที่ใช้กับบริการนี้ได้</p>
                      )}
                      {memberPackagesQuery.isSuccess && eligiblePackages.length > 0 && (
                        <Select
                          aria-label="เลือกคอร์สที่จะตัด"
                          value={memberPackageId}
                          onChange={(e) => setMemberPackageId(e.target.value)}
                        >
                          <option value="" disabled>
                            -- เลือกคอร์สที่จะตัด --
                          </option>
                          {eligiblePackages.map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} (
                              {pkg.type === "SESSION_COUNT"
                                ? `เหลือ ${pkg.balance} ครั้ง`
                                : pkg.type === "VALUE"
                                  ? `เหลือ ${formatSatang(pkg.balance)}`
                                  : "ไม่จำกัดครั้ง"}
                              )
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChoosingPayment(false);
                        setPaymentMethod("CASH");
                        setMemberPackageId("");
                      }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      disabled={isPending || (paymentMethod === "PACKAGE" && !memberPackageId)}
                      onClick={() => {
                        onChangeStatus(
                          item,
                          "IN_SERVICE",
                          paymentMethod,
                          paymentMethod === "PACKAGE" ? memberPackageId : undefined,
                        );
                        setChoosingPayment(false);
                      }}
                    >
                      ยืนยันเริ่มงาน
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

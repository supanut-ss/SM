"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton } from "@lotus-desk/ui";
import { ApiError, cashierShiftApi, type CashierShift } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { ManagerPinDialog } from "./manager-pin-dialog";

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
 * รอบกะแคชเชียร์ (T5.7) — เปิด/ปิดทำได้เอง (ยอดระบบคำนวณฝั่ง server เสมอ ไม่รับตัวเลขจาก client)
 * "เปิดใหม่" หลังปิดแล้วต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 16) — ปิดรอบแล้วยกเลิกบิลเก่าที่อยู่ใน
 * ช่วงเวลานั้นจะโดน 409 จาก BillController.cancel ทันที (ข้อความบอกให้เปิดรอบกะใหม่อยู่แล้ว)
 */
export function CashierShiftPanel({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [countedCashBaht, setCountedCashBaht] = useState<number | "">("");
  const [varianceReason, setVarianceReason] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const currentKey = ["cashier-shift-current", branchId];
  const listKey = ["cashier-shifts", branchId];

  const currentQuery = useQuery({
    queryKey: currentKey,
    queryFn: () => cashierShiftApi.current(branchId),
  });

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => cashierShiftApi.list(branchId),
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: currentKey });
    void queryClient.invalidateQueries({ queryKey: listKey });
  }

  const openMutation = useMutation({
    mutationFn: () => cashierShiftApi.open(branchId),
    onSuccess: invalidateAll,
  });

  const closeMutation = useMutation({
    mutationFn: (shiftId: string) =>
      cashierShiftApi.close(branchId, shiftId, {
        countedCashSatang: Math.round(Number(countedCashBaht) * 100),
        varianceReason: varianceReason.trim() || undefined,
      }),
    onSuccess: () => {
      setClosing(false);
      setCountedCashBaht("");
      setVarianceReason("");
      setCloseError(null);
      invalidateAll();
    },
    onError: (err) => {
      setCloseError(err instanceof ApiError ? err.message : "ปิดรอบกะไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ shiftId, approvalToken }: { shiftId: string; approvalToken: string }) =>
      cashierShiftApi.reopen(branchId, shiftId, { approvalToken }),
    onSuccess: invalidateAll,
  });

  const current: CashierShift | null = currentQuery.data?.shift ?? null;

  return (
    <div className="mb-6 rounded-DEFAULT border border-line-strong bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-balance text-sm font-semibold text-ink">รอบกะแคชเชียร์</h2>
          {currentQuery.isLoading && (
            <Skeleton className="h-4 w-32" role="status" aria-label="กำลังโหลด" />
          )}
          {currentQuery.isSuccess && current === null && (
            <p className="text-pretty text-xs text-ink-muted">ยังไม่มีรอบกะเปิดอยู่</p>
          )}
          {current && (
            <p className="text-pretty text-xs text-celadon">เปิดรอบกะอยู่ — เปิดเมื่อ {formatDateTime(current.openedAt)}</p>
          )}
        </div>
        <div className="flex gap-2">
          {currentQuery.isSuccess && current === null && (
            <Button size="sm" disabled={openMutation.isPending} onClick={() => openMutation.mutate()}>
              {openMutation.isPending ? "กำลังเปิด..." : "เปิดรอบกะ"}
            </Button>
          )}
          {current && !closing && (
            <Button size="sm" variant="secondary" onClick={() => setClosing(true)}>
              ปิดรอบกะ
            </Button>
          )}
        </div>
      </div>

      {current && closing && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="counted-cash" className="text-[10px]">
              เงินสดที่นับได้ในลิ้นชัก (บาท)
            </Label>
            <Input
              id="counted-cash"
              type="number"
              min={0}
              step={0.01}
              value={countedCashBaht}
              onChange={(event) =>
                setCountedCashBaht(event.target.value === "" ? "" : Number(event.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="variance-reason" className="text-[10px]">
              เหตุผลส่วนต่าง (กรอกถ้ายอดไม่ตรง)
            </Label>
            <Input
              id="variance-reason"
              value={varianceReason}
              onChange={(event) => setVarianceReason(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setClosing(false);
                setCloseError(null);
              }}
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              disabled={countedCashBaht === "" || closeMutation.isPending}
              onClick={() => closeMutation.mutate(current.id)}
            >
              {closeMutation.isPending ? "กำลังปิด..." : "ยืนยันปิดรอบกะ"}
            </Button>
          </div>
          {closeError && (
            <p role="alert" className="text-pretty col-span-full rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {closeError}
            </p>
          )}
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เปิด</TableHead>
                <TableHead>ปิด</TableHead>
                <TableHead className="text-right">นับได้</TableHead>
                <TableHead className="text-right">ยอดระบบ</TableHead>
                <TableHead className="text-right">ส่วนต่าง</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.data.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>{formatDateTime(shift.openedAt)}</TableCell>
                  <TableCell>{shift.closedAt ? formatDateTime(shift.closedAt) : "ยังเปิดอยู่"}</TableCell>
                  <TableCell className="text-right font-data tabular-nums">
                    {shift.countedCashSatang === null ? "—" : formatSatang(shift.countedCashSatang)}
                  </TableCell>
                  <TableCell className="text-right font-data tabular-nums">
                    {shift.systemCashSatang === null ? "—" : formatSatang(shift.systemCashSatang)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-data tabular-nums ${
                      shift.varianceSatang ? "text-brass" : ""
                    }`}
                  >
                    {shift.varianceSatang === null ? "—" : formatSatang(shift.varianceSatang)}
                  </TableCell>
                  <TableCell className="text-right">
                    {shift.closedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReopenTargetId(shift.id);
                          setPinDialogOpen(true);
                        }}
                      >
                        เปิดใหม่
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ManagerPinDialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        branchId={branchId}
        title="ยืนยัน PIN ผู้จัดการเพื่อเปิดรอบกะใหม่"
        description="รอบกะนี้ปิดไปแล้ว ต้องมีผู้จัดการหรือเจ้าของร้านกรอก PIN ก่อนเปิดใหม่ได้เสมอ"
        onApproved={(approvalToken) => {
          if (reopenTargetId) reopenMutation.mutate({ shiftId: reopenTargetId, approvalToken });
          setPinDialogOpen(false);
          setReopenTargetId(null);
        }}
      />
    </div>
  );
}

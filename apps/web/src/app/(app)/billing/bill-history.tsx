"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BILL_STATUS_LABEL } from "@lotus-desk/contracts";
import { Button, Sheet, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Label, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import { ApiError, billApi, type Bill } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { ManagerPinDialog } from "./manager-pin-dialog";
import { Receipt } from "./receipt";

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
 * ประวัติบิล (T5.6) — ยกเลิกบิลต้องมี PIN ผู้จัดการเสมอ (docs/DOMAIN.md ข้อ 14): เปิด ManagerPinDialog
 * ก่อนเสมอ ได้ approvalToken อายุสั้นมาแล้วค่อยเปิดชีทให้กรอกเหตุผลแล้วยิง billApi.cancel จริง
 * (สองขั้นตอนแยกกันชัดเจน กันพลาดกดยกเลิกโดยไม่ได้ตั้งใจหลัง PIN ผ่านแล้ว)
 */
export function BillHistory({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient();
  const [pinDialogBillId, setPinDialogBillId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ billId: string; approvalToken: string } | null>(null);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  const listQuery = useQuery({
    queryKey: ["bills", branchId],
    queryFn: () => billApi.list(branchId),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      billApi.cancel(branchId, cancelTarget!.billId, {
        approvalToken: cancelTarget!.approvalToken,
        reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bills", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["appointment-items", branchId] });
      setCancelTarget(null);
      setReason("");
      setCancelError(null);
    },
    onError: (err) => {
      setCancelError(err instanceof ApiError ? err.message : "ยกเลิกบิลไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  return (
    <div>
      <h2 className="text-balance mb-3 font-display text-lg font-semibold text-ink">ประวัติบิล</h2>

      {listQuery.isLoading && (
        <SkeletonGroup label="กำลังโหลดประวัติบิล">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </SkeletonGroup>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError ? listQuery.error.message : "โหลดประวัติบิลไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void listQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-pretty text-sm text-ink-muted">ยังไม่มีบิลในสาขานี้ — ออกบิลแรกจากรายการด้านบน</p>
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เลขที่บิล</TableHead>
              <TableHead>เวลา</TableHead>
              <TableHead>รายการ</TableHead>
              <TableHead className="text-right">ยอดสุทธิ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-medium">{bill.billNumber}</TableCell>
                <TableCell>{formatDateTime(bill.createdAt)}</TableCell>
                <TableCell>{bill.lines.length} รายการ</TableCell>
                <TableCell className="text-right font-data tabular-nums">{formatSatang(bill.totalSatang)}</TableCell>
                <TableCell>
                  <span
                    className={
                      bill.status === "PAID"
                        ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                        : "inline-flex rounded-DEFAULT bg-rose-tint px-2 py-0.5 text-xs font-medium text-rose"
                    }
                  >
                    {BILL_STATUS_LABEL[bill.status]}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setViewingBill(bill)}>
                      ดูใบเสร็จ
                    </Button>
                    {bill.status === "PAID" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose hover:bg-rose-tint"
                        onClick={() => setPinDialogBillId(bill.id)}
                      >
                        ยกเลิกบิล
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ManagerPinDialog
        open={pinDialogBillId !== null}
        onClose={() => setPinDialogBillId(null)}
        branchId={branchId}
        title="ยืนยัน PIN ผู้จัดการเพื่อยกเลิกบิล"
        description="ต้องมีผู้จัดการหรือเจ้าของร้านกรอก PIN ก่อนยกเลิกบิลได้เสมอ"
        onApproved={(approvalToken) => {
          setCancelTarget({ billId: pinDialogBillId!, approvalToken });
          setPinDialogBillId(null);
        }}
      />

      <Sheet
        open={cancelTarget !== null}
        onClose={() => {
          setCancelTarget(null);
          setReason("");
          setCancelError(null);
        }}
        title="ยกเลิกบิล"
        description="คืนยอดคอร์สที่ตัดไปแล้ว คืนโควตาโปรฯ และทำใบงานที่ผูกอยู่เป็นโมฆะทั้งหมด"
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">เหตุผลการยกเลิก</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
          {cancelError && (
            <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {cancelError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              ปิด
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? "กำลังยกเลิก..." : "ยืนยันยกเลิกบิล"}
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet open={viewingBill !== null} onClose={() => setViewingBill(null)} title={viewingBill?.billNumber ?? ""}>
        {viewingBill && <Receipt bill={viewingBill} onClose={() => setViewingBill(null)} />}
      </Sheet>
    </div>
  );
}

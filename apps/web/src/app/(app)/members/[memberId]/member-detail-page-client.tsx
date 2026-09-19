"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BILL_STATUS_LABEL } from "@lotus-desk/contracts";
import type { UpdateMemberInput } from "@lotus-desk/contracts";
import { Button, Sheet, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import { ApiError, billApi, memberApi } from "../../../../lib/api-client";
import { formatSatang } from "../../../../lib/format-money";
import { useCurrentBranch } from "../../current-branch-context";
import { hasPermission } from "../../permissions";
import { MemberConsentSection } from "../member-consent-section";
import { MemberPackageSection } from "../member-package-section";
import { MemberForm, type MemberFormValues } from "../member-form";

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
 * รายละเอียดสมาชิกรายคน (route แรกในระบบนี้ที่เป็น dynamic segment) — เดิมมีแค่หน้ารายชื่อที่เปิดชีทแก้ไข
 * ไม่มี URL เฉพาะของสมาชิกคนเดียว การ์ด "คอร์สใกล้หมดอายุ"/"ลูกค้าที่หายไปเกิน 60 วัน" บนแดชบอร์ด (T7.3)
 * เลยต้องพา workaround ไป /members?q=<รหัส> แทน (ดู docs/decisions.md ADR-038) route นี้ปิดช่องว่างนั้น —
 * ใช้ MemberConsentSection/MemberPackageSection ชุดเดิมจากชีทแก้ไขตรง ๆ (props เดียวกัน) ไม่แตะ internals
 */
export function MemberDetailPageClient({ memberId }: { memberId: string }) {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "member");
  const [editOpen, setEditOpen] = useState(false);

  const memberQuery = useQuery({
    queryKey: ["member", branch?.branchId, memberId],
    queryFn: () => memberApi.get(branch!.branchId, memberId),
    enabled: !!branch?.branchId,
    retry: (failureCount, error) => (error instanceof ApiError && error.status === 404 ? false : failureCount < 2),
  });

  const billsQuery = useQuery({
    queryKey: ["bills", branch?.branchId, "member", memberId],
    queryFn: () => billApi.list(branch!.branchId, memberId),
    enabled: !!branch?.branchId && memberQuery.isSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateMemberInput) => memberApi.update(branch!.branchId, memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member", branch?.branchId, memberId] });
      void queryClient.invalidateQueries({ queryKey: ["members", branch?.branchId] });
      setEditOpen(false);
    },
  });

  const member = memberQuery.data;
  const sheetInitialValues = useMemo<Partial<MemberFormValues> | undefined>(() => {
    if (!member) return undefined;
    return { name: member.name, phone: member.phone, note: member.note ?? "" };
  }, [member]);

  if (!branch) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-pretty rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
      >
        ← กลับไปรายชื่อสมาชิก
      </Link>

      {memberQuery.isLoading && (
        <SkeletonGroup label="กำลังโหลดข้อมูลสมาชิก" className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24" />
        </SkeletonGroup>
      )}

      {memberQuery.isError && memberQuery.error instanceof ApiError && memberQuery.error.status === 404 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-pretty text-sm text-ink-muted">ไม่พบสมาชิกนี้ — อาจถูกลบหรือรหัสไม่ถูกต้อง</p>
          <Link
            href="/members"
            className="mt-4 inline-flex text-sm font-medium text-celadon hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
          >
            กลับไปรายชื่อสมาชิกทั้งหมด
          </Link>
        </div>
      )}

      {memberQuery.isError && !(memberQuery.error instanceof ApiError && memberQuery.error.status === 404) && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {memberQuery.error instanceof ApiError ? memberQuery.error.message : "โหลดข้อมูลสมาชิกไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void memberQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {memberQuery.isSuccess && member && (
        <div className="grid gap-6">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-balance font-display text-2xl font-semibold text-ink">{member.name}</h1>
                <span
                  className={
                    member.mergedIntoId
                      ? "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                      : member.isActive
                        ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                        : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                  }
                >
                  {member.mergedIntoId ? "รวมเข้าสมาชิกอื่นแล้ว" : member.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                </span>
              </div>
              <p className="text-pretty mt-1 font-data text-sm tabular-nums text-ink-muted">
                {member.code} · {member.phone}
              </p>
              {member.note && <p className="text-pretty mt-2 text-sm text-ink-muted">{member.note}</p>}
            </div>
            {canManage && <Button onClick={() => setEditOpen(true)}>แก้ไขข้อมูล</Button>}
          </div>

          <MemberConsentSection branchId={branch.branchId} memberId={member.id} />
          <MemberPackageSection branchId={branch.branchId} memberId={member.id} />

          <section aria-label="ประวัติการซื้อ" className="grid gap-3">
            <h2 className="text-balance font-display text-lg font-semibold text-ink">ประวัติการซื้อ</h2>

            {billsQuery.isLoading && (
              <SkeletonGroup label="กำลังโหลดประวัติการซื้อ">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </SkeletonGroup>
            )}

            {billsQuery.isError && (
              <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
                {billsQuery.error instanceof ApiError
                  ? billsQuery.error.message
                  : "โหลดประวัติการซื้อไม่สำเร็จ กรุณาลองใหม่"}
                <Button variant="secondary" size="sm" className="ml-3" onClick={() => void billsQuery.refetch()}>
                  ลองใหม่
                </Button>
              </div>
            )}

            {billsQuery.isSuccess && billsQuery.data.length === 0 && (
              <div className="rounded-lg border border-dashed border-line-strong p-6 text-center">
                <p className="text-pretty text-sm text-ink-muted">สมาชิกคนนี้ยังไม่มีประวัติการซื้อ</p>
              </div>
            )}

            {billsQuery.isSuccess && billsQuery.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่บิล</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">ยอดสุทธิ</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billsQuery.data.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.billNumber}</TableCell>
                      <TableCell>{formatDateTime(bill.createdAt)}</TableCell>
                      <TableCell className="text-right font-data tabular-nums">
                        {formatSatang(bill.totalSatang)}
                      </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      )}

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title={member ? `แก้ไขข้อมูล — ${member.name}` : "แก้ไขข้อมูล"}>
        <MemberForm
          key={member?.id}
          initialValues={sheetInitialValues}
          submitLabel="บันทึกการแก้ไข"
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            await updateMutation.mutateAsync(values);
          }}
        />
      </Sheet>
    </div>
  );
}

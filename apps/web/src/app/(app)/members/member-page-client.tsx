"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateMemberInput, UpdateMemberInput } from "@lotus-desk/contracts";
import {
  Button,
  ListCard,
  ResponsiveList,
  Select,
  Sheet,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lotus-desk/ui";
import type { ReactNode } from "react";
import { ApiError, memberApi, type Member } from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { MemberConsentSection } from "./member-consent-section";
import { MemberPackageSection } from "./member-package-section";
import { MemberForm, type MemberFormValues } from "./member-form";
import { MemberMergeSection } from "./member-merge-section";

type ActiveFilter = "true" | "false" | "all";

export function MemberPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "member");

  // ?q= จาก URL (เช่น ลิงก์จากแดชบอร์ด T7.3 "คอร์สใกล้หมดอายุ"/"ลูกค้าหายไป") ใช้เป็นค่าเริ่มต้นของช่อง
  // ค้นหาทันที ไม่ต้องรอ debounce 300ms เหมือนตอนพิมพ์เอง เพราะเป็นค่าที่ตั้งใจมาแล้วจากที่อื่น
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [marketingFilter, setMarketingFilter] = useState<"" | "true" | "false">("");
  const [sheetTarget, setSheetTarget] = useState<"create" | Member | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ["members", branch?.branchId, debouncedQuery, activeFilter, marketingFilter],
    queryFn: () =>
      memberApi.list(branch!.branchId, {
        q: debouncedQuery || undefined,
        isActive: activeFilter,
        marketingConsent: marketingFilter || undefined,
      }),
    enabled: !!branch?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateMemberInput) => memberApi.create(branch!.branchId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", branch?.branchId] });
      setSheetTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: UpdateMemberInput }) =>
      memberApi.update(branch!.branchId, memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", branch?.branchId] });
      setSheetTarget(null);
      setConfirmingDeactivateId(null);
    },
  });

  const editingRecord = sheetTarget && sheetTarget !== "create" ? sheetTarget : null;
  const sheetInitialValues = useMemo<Partial<MemberFormValues> | undefined>(() => {
    if (!editingRecord) return undefined;
    return { name: editingRecord.name, phone: editingRecord.phone, note: editingRecord.note ?? "" };
  }, [editingRecord]);

  function renderMemberActions(member: Member): ReactNode {
    if (!canManage) return null;
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setSheetTarget(member)}>
          แก้ไข
        </Button>
        {member.mergedIntoId ? null : confirmingDeactivateId === member.id ? (
          <>
            <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ memberId: member.id, input: { isActive: false } })}
            >
              ปิดใช้งาน
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivateId(null)}>
              ไม่ใช่
            </Button>
          </>
        ) : member.isActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-rose hover:bg-rose-tint"
            onClick={() => setConfirmingDeactivateId(member.id)}
          >
            ปิดใช้งาน
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ memberId: member.id, input: { isActive: true } })}
          >
            เปิดใช้งานอีกครั้ง
          </Button>
        )}
      </>
    );
  }

  function renderMemberBadge(member: Member): ReactNode {
    return (
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
    );
  }

  if (!branch) {
    return (
      <div className="p-8">
        <p className="rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">สมาชิก</h1>
          <p className="mt-1 text-sm text-ink-muted">รายชื่อสมาชิกของสาขา {branch.branchName}</p>
        </div>
        {canManage && <Button onClick={() => setSheetTarget("create")}>+ เพิ่มสมาชิก</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          aria-label="ค้นหาสมาชิก"
          className="h-9 w-64 rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
        />
        <Select
          aria-label="กรองตามสถานะ"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="w-44"
        >
          <option value="true">ใช้งานอยู่</option>
          <option value="false">ปิดใช้งานแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </Select>
        <Select
          aria-label="กรองตามความยินยอมรับข่าวสาร"
          value={marketingFilter}
          onChange={(event) => setMarketingFilter(event.target.value as "" | "true" | "false")}
          className="w-52"
        >
          <option value="">ทุกสถานะความยินยอม</option>
          <option value="true">ยินยอมรับข่าวสาร</option>
          <option value="false">ไม่ยินยอม/ถอนแล้ว</option>
        </Select>
      </div>

      {listQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายชื่อสมาชิก">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : "โหลดรายชื่อสมาชิกไม่สำเร็จ กรุณาลองใหม่"}
          <Button
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => void listQuery.refetch()}
          >
            ลองใหม่
          </Button>
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-ink-muted">
            {debouncedQuery
              ? `ไม่พบสมาชิกที่ตรงกับ "${debouncedQuery}"`
              : activeFilter === "false"
                ? "ยังไม่มีสมาชิกที่ปิดใช้งาน"
                : "ยังไม่มีสมาชิกในสาขานี้"}
          </p>
          {canManage && !debouncedQuery && activeFilter !== "false" && (
            <Button className="mt-4" onClick={() => setSheetTarget("create")}>
              + เพิ่มสมาชิกแรก
            </Button>
          )}
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <ResponsiveList
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสสมาชิก</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>โปรไฟล์</TableHead>
                  {canManage && <TableHead className="text-right">จัดการ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-data tabular-nums">{member.code}</TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="font-data tabular-nums">{member.phone}</TableCell>
                    <TableCell>{renderMemberBadge(member)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/members/${member.id}`}
                        className="text-sm font-medium text-celadon hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
                      >
                        ดูโปรไฟล์
                      </Link>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">{renderMemberActions(member)}</div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          cards={listQuery.data.map((member) => (
            <ListCard
              key={member.id}
              title={member.name}
              badge={renderMemberBadge(member)}
              lines={[member.code, member.phone]}
              actions={
                <>
                  <Link
                    href={`/members/${member.id}`}
                    className="text-sm font-medium text-celadon hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
                  >
                    ดูโปรไฟล์
                  </Link>
                  {renderMemberActions(member)}
                </>
              }
            />
          ))}
        />
      )}

      <Sheet
        open={sheetTarget !== null}
        onClose={() => setSheetTarget(null)}
        title={editingRecord ? `แก้ไขข้อมูล — ${editingRecord.name}` : "เพิ่มสมาชิกใหม่"}
      >
        <div className="grid gap-6">
          <MemberForm
            key={editingRecord?.id ?? "create"}
            initialValues={sheetInitialValues}
            submitLabel={editingRecord ? "บันทึกการแก้ไข" : "เพิ่มสมาชิก"}
            onCancel={() => setSheetTarget(null)}
            onSubmit={async (values) => {
              if (editingRecord) {
                await updateMutation.mutateAsync({ memberId: editingRecord.id, input: values });
              } else {
                await createMutation.mutateAsync(values);
              }
            }}
          />
          {editingRecord && (
            <>
              <MemberConsentSection branchId={branch.branchId} memberId={editingRecord.id} />
              <MemberPackageSection branchId={branch.branchId} memberId={editingRecord.id} />
              <MemberMergeSection
                branchId={branch.branchId}
                member={editingRecord}
                onMerged={() => setSheetTarget(null)}
              />
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  STAFF_LEVEL_LABEL,
  STAFF_SKILL_LABEL,
  type CreateStaffInput,
  type StaffSkill,
  type UpdateStaffInput,
} from "@lotus-desk/contracts";
import { Button, Select, Sheet, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@lotus-desk/ui";
import { ApiError, staffApi, type StaffProfile } from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { StaffForm, type StaffFormValues } from "./staff-form";

type ActiveFilter = "true" | "false" | "all";

function formatSkills(skills: StaffSkill[]): string {
  return skills.map((s) => STAFF_SKILL_LABEL[s]).join(", ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
}

export function StaffPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "staff");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [sheetTarget, setSheetTarget] = useState<"create" | StaffProfile | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ["staff", branch?.branchId, debouncedQuery, activeFilter],
    queryFn: () =>
      staffApi.list(branch!.branchId, { q: debouncedQuery || undefined, isActive: activeFilter }),
    enabled: !!branch?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateStaffInput) => staffApi.create(branch!.branchId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff", branch?.branchId] });
      setSheetTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ staffId, input }: { staffId: string; input: UpdateStaffInput }) =>
      staffApi.update(branch!.branchId, staffId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff", branch?.branchId] });
      setSheetTarget(null);
      setConfirmingDeactivateId(null);
    },
  });

  const editingRecord = sheetTarget && sheetTarget !== "create" ? sheetTarget : null;
  const sheetInitialValues = useMemo<Partial<StaffFormValues> | undefined>(() => {
    if (!editingRecord) return undefined;
    return {
      name: editingRecord.name,
      phone: editingRecord.phone ?? "",
      level: editingRecord.level,
      skills: editingRecord.skills,
      startDate: editingRecord.startDate ? new Date(editingRecord.startDate) : undefined,
      note: editingRecord.note ?? "",
    };
  }, [editingRecord]);

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
          <h1 className="font-display text-2xl font-semibold text-ink">พนักงาน</h1>
          <p className="mt-1 text-sm text-ink-muted">รายชื่อพนักงานให้บริการของสาขา {branch.branchName}</p>
        </div>
        {canManage && <Button onClick={() => setSheetTarget("create")}>+ เพิ่มพนักงาน</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          aria-label="ค้นหาพนักงาน"
          className="h-9 w-64 rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
        />
        <Select
          aria-label="กรองตามสถานะ"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="w-44"
        >
          <option value="true">กำลังทำงาน</option>
          <option value="false">ปิดใช้งานแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </Select>
      </div>

      {listQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายชื่อพนักงาน">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : "โหลดรายชื่อพนักงานไม่สำเร็จ กรุณาลองใหม่"}
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
              ? `ไม่พบพนักงานที่ตรงกับ "${debouncedQuery}"`
              : activeFilter === "false"
                ? "ยังไม่มีพนักงานที่ปิดใช้งาน"
                : "ยังไม่มีพนักงานในสาขานี้"}
          </p>
          {canManage && !debouncedQuery && activeFilter !== "false" && (
            <Button className="mt-4" onClick={() => setSheetTarget("create")}>
              + เพิ่มพนักงานคนแรก
            </Button>
          )}
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>เบอร์โทร</TableHead>
              <TableHead>ระดับ</TableHead>
              <TableHead>ทักษะ</TableHead>
              <TableHead>วันเริ่มงาน</TableHead>
              <TableHead>สถานะ</TableHead>
              {canManage && <TableHead className="text-right">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell className="font-medium">{staff.name}</TableCell>
                <TableCell className="font-data tabular-nums">{staff.phone ?? "-"}</TableCell>
                <TableCell>{STAFF_LEVEL_LABEL[staff.level]}</TableCell>
                <TableCell>{formatSkills(staff.skills)}</TableCell>
                <TableCell className="font-data tabular-nums">{formatDate(staff.startDate)}</TableCell>
                <TableCell>
                  <span
                    className={
                      staff.isActive
                        ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                        : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                    }
                  >
                    {staff.isActive ? "กำลังทำงาน" : "ปิดใช้งาน"}
                  </span>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSheetTarget(staff)}>
                        แก้ไข
                      </Button>
                      {confirmingDeactivateId === staff.id ? (
                        <>
                          <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({ staffId: staff.id, input: { isActive: false } })
                            }
                          >
                            ปิดใช้งาน
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingDeactivateId(null)}
                          >
                            ไม่ใช่
                          </Button>
                        </>
                      ) : staff.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose hover:bg-rose-tint"
                          onClick={() => setConfirmingDeactivateId(staff.id)}
                        >
                          ปิดใช้งาน
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({ staffId: staff.id, input: { isActive: true } })
                          }
                        >
                          เปิดใช้งานอีกครั้ง
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet
        open={sheetTarget !== null}
        onClose={() => setSheetTarget(null)}
        title={editingRecord ? `แก้ไขข้อมูล — ${editingRecord.name}` : "เพิ่มพนักงานใหม่"}
      >
        <StaffForm
          key={editingRecord?.id ?? "create"}
          initialValues={sheetInitialValues}
          submitLabel={editingRecord ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
          onCancel={() => setSheetTarget(null)}
          onSubmit={async (values) => {
            if (editingRecord) {
              await updateMutation.mutateAsync({ staffId: editingRecord.id, input: values });
            } else {
              await createMutation.mutateAsync(values);
            }
          }}
        />
      </Sheet>
    </div>
  );
}

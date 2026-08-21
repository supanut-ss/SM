"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRoomInput, UpdateRoomInput } from "@lotus-desk/contracts";
import { Button, Select, Sheet, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@lotus-desk/ui";
import { ApiError, roomApi, roomTypeApi, type Room } from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { RoomForm, type RoomFormValues } from "./room-form";

type ActiveFilter = "true" | "false" | "all";

export function RoomPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "room");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [sheetTarget, setSheetTarget] = useState<"create" | Room | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const roomTypesQuery = useQuery({
    queryKey: ["room-types", branch?.branchId],
    queryFn: () => roomTypeApi.list(branch!.branchId),
    enabled: !!branch?.branchId,
  });

  const listQuery = useQuery({
    queryKey: ["rooms", branch?.branchId, debouncedQuery, activeFilter],
    queryFn: () =>
      roomApi.list(branch!.branchId, { q: debouncedQuery || undefined, isActive: activeFilter }),
    enabled: !!branch?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateRoomInput) => roomApi.create(branch!.branchId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rooms", branch?.branchId] });
      setSheetTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roomId, input }: { roomId: string; input: UpdateRoomInput }) =>
      roomApi.update(branch!.branchId, roomId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rooms", branch?.branchId] });
      setSheetTarget(null);
      setConfirmingDeactivateId(null);
    },
  });

  const editingRecord = sheetTarget && sheetTarget !== "create" ? sheetTarget : null;
  const sheetInitialValues = useMemo<Partial<RoomFormValues> | undefined>(() => {
    if (!editingRecord) return undefined;
    return {
      name: editingRecord.name,
      roomTypeId: editingRecord.roomTypeId,
      capacity: editingRecord.capacity,
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
          <h1 className="font-display text-2xl font-semibold text-ink">ห้อง/เตียง</h1>
          <p className="mt-1 text-sm text-ink-muted">รายชื่อห้อง/เตียงให้บริการของสาขา {branch.branchName}</p>
        </div>
        {canManage && <Button onClick={() => setSheetTarget("create")}>+ เพิ่มห้อง</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหาชื่อห้อง..."
          aria-label="ค้นหาห้อง"
          className="h-9 w-64 rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
        />
        <Select
          aria-label="กรองตามสถานะ"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="w-44"
        >
          <option value="true">พร้อมใช้งาน</option>
          <option value="false">ปิดใช้งานแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </Select>
      </div>

      {listQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายชื่อห้อง">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : "โหลดรายชื่อห้องไม่สำเร็จ กรุณาลองใหม่"}
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
              ? `ไม่พบห้องที่ตรงกับ "${debouncedQuery}"`
              : activeFilter === "false"
                ? "ยังไม่มีห้องที่ปิดใช้งาน"
                : "ยังไม่มีห้องในสาขานี้"}
          </p>
          {canManage && !debouncedQuery && activeFilter !== "false" && (
            <Button className="mt-4" onClick={() => setSheetTarget("create")}>
              + เพิ่มห้องแรก
            </Button>
          )}
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อห้อง</TableHead>
              <TableHead>ประเภทห้อง</TableHead>
              <TableHead className="text-right">ความจุ</TableHead>
              <TableHead>สถานะ</TableHead>
              {canManage && <TableHead className="text-right">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">{room.name}</TableCell>
                <TableCell>{room.roomType.name}</TableCell>
                <TableCell className="text-right font-data tabular-nums">{room.capacity}</TableCell>
                <TableCell>
                  <span
                    className={
                      room.isActive
                        ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                        : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                    }
                  >
                    {room.isActive ? "พร้อมใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSheetTarget(room)}>
                        แก้ไข
                      </Button>
                      {confirmingDeactivateId === room.id ? (
                        <>
                          <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({ roomId: room.id, input: { isActive: false } })
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
                      ) : room.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose hover:bg-rose-tint"
                          onClick={() => setConfirmingDeactivateId(room.id)}
                        >
                          ปิดใช้งาน
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({ roomId: room.id, input: { isActive: true } })
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
        title={editingRecord ? `แก้ไขข้อมูล — ${editingRecord.name}` : "เพิ่มห้องใหม่"}
      >
        <RoomForm
          key={editingRecord?.id ?? "create"}
          roomTypes={roomTypesQuery.data ?? []}
          initialValues={sheetInitialValues}
          submitLabel={editingRecord ? "บันทึกการแก้ไข" : "เพิ่มห้อง"}
          onCancel={() => setSheetTarget(null)}
          onSubmit={async (values) => {
            if (editingRecord) {
              await updateMutation.mutateAsync({ roomId: editingRecord.id, input: values });
            } else {
              await createMutation.mutateAsync(values);
            }
          }}
        />
      </Sheet>
    </div>
  );
}

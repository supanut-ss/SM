"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Sheet, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import { ApiError, serviceCategoryApi, type ServiceCategory } from "../../../lib/api-client";

export function ServiceCategoryManagerSheet({
  open,
  onClose,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["service-categories", branchId],
    queryFn: () => serviceCategoryApi.list(branchId),
    enabled: open && !!branchId,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["service-categories", branchId] });
    void queryClient.invalidateQueries({ queryKey: ["services", branchId] });
  }

  const createMutation = useMutation({
    mutationFn: () => serviceCategoryApi.create(branchId, { name: newName.trim() }),
    onSuccess: () => {
      setNewName("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "เพิ่มหมวดบริการไม่สำเร็จ"),
  });

  const updateMutation = useMutation({
    mutationFn: (category: ServiceCategory) =>
      serviceCategoryApi.update(branchId, category.id, { name: editingName.trim() }),
    onSuccess: () => {
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "แก้ไขหมวดบริการไม่สำเร็จ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => serviceCategoryApi.remove(branchId, categoryId),
    onSuccess: () => {
      setConfirmingDeleteId(null);
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setConfirmingDeleteId(null);
      setError(err instanceof ApiError ? err.message : "ลบหมวดบริการไม่สำเร็จ");
    },
  });

  function handleClose() {
    setNewName("");
    setEditingId(null);
    setConfirmingDeleteId(null);
    setError(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={handleClose} title="จัดการหมวดบริการ">
      <div className="grid gap-4">
        <p className="text-pretty text-sm text-ink-muted">
          หมวดบริการใช้จัดกลุ่มรายการในหน้าบริการ เช่น นวด สปา หรือเล็บ — ลบได้เฉพาะหมวดที่ไม่มีบริการใช้อยู่
        </p>

        {error && <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">{error}</p>}

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="ชื่อหมวดบริการใหม่..."
            aria-label="ชื่อหมวดบริการใหม่"
            className="h-11 flex-1 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
          />
          <Button disabled={!newName.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            + เพิ่ม
          </Button>
        </div>

        {listQuery.isLoading && (
          <SkeletonGroup label="กำลังโหลดหมวดบริการ">
            {[0, 1, 2].map((index) => <Skeleton key={index} className="h-10 w-full" />)}
          </SkeletonGroup>
        )}
        {listQuery.isError && (
          <div role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
            โหลดหมวดบริการไม่สำเร็จ
            <Button variant="secondary" size="sm" className="ml-3" onClick={() => void listQuery.refetch()}>ลองใหม่</Button>
          </div>
        )}
        {listQuery.isSuccess && listQuery.data.length === 0 && (
          <p className="text-pretty text-sm text-ink-muted">ยังไม่มีหมวดบริการในสาขานี้ — เพิ่มด้านบนได้เลย</p>
        )}
        {listQuery.isSuccess && listQuery.data.length > 0 && (
          <ul className="grid gap-2">
            {listQuery.data.map((category) => (
              <li key={category.id} className="flex items-center gap-2 rounded-DEFAULT border border-line p-2">
                {editingId === category.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      aria-label={`แก้ชื่อ ${category.name}`}
                      className="h-9 flex-1 rounded-DEFAULT border border-line-strong bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
                    />
                    <Button size="sm" disabled={!editingName.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate(category)}>บันทึก</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>ยกเลิก</Button>
                  </>
                ) : confirmingDeleteId === category.id ? (
                  <>
                    <span className="flex-1 text-xs text-ink-muted">ลบ &quot;{category.name}&quot; เลยไหม?</span>
                    <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(category.id)}>ยืนยันลบ</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingDeleteId(null)}>ไม่ใช่</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-ink">{category.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(category.id); setEditingName(category.name); }}>แก้ไข</Button>
                    <Button variant="ghost" size="sm" className="text-rose hover:bg-rose-tint" onClick={() => setConfirmingDeleteId(category.id)}>ลบ</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="ghost" onClick={handleClose}>ปิด</Button>
        </div>
      </div>
    </Sheet>
  );
}

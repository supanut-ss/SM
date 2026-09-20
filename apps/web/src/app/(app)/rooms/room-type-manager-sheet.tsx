"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Sheet, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import { ApiError, roomTypeApi, type RoomType } from "../../../lib/api-client";

/**
 * จัดการประเภทห้อง (T-ADR-062) — เดิม T2.2 ตั้งใจไม่ทำหน้านี้ (ดู ADR-010) เพราะขอบเขตตอนนั้นเน้นที่ Room
 * ไม่ใช่ RoomType แต่ RoomType ไม่มี isActive ในสคีมา (ไม่เคยออกแบบให้ soft delete) — "ลบ" ที่นี่จึงเป็นการ
 * ลบจริง ทำได้เฉพาะตอนไม่มีห้อง/บริการอ้างอิงอยู่เท่านั้น (backend เช็คแล้วคืน 409 พร้อมบอกจำนวนที่ค้าง)
 */
export function RoomTypeManagerSheet({
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
    queryKey: ["room-types", branchId],
    queryFn: () => roomTypeApi.list(branchId),
    enabled: open && !!branchId,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["room-types", branchId] });
  }

  const createMutation = useMutation({
    mutationFn: () => roomTypeApi.create(branchId, { name: newName.trim() }),
    onSuccess: () => {
      setNewName("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "เพิ่มประเภทห้องไม่สำเร็จ"),
  });

  const updateMutation = useMutation({
    mutationFn: (roomType: RoomType) => roomTypeApi.update(branchId, roomType.id, { name: editingName.trim() }),
    onSuccess: () => {
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "แก้ไขประเภทห้องไม่สำเร็จ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (roomTypeId: string) => roomTypeApi.remove(branchId, roomTypeId),
    onSuccess: () => {
      setError(null);
      setConfirmingDeleteId(null);
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "ลบประเภทห้องไม่สำเร็จ");
      setConfirmingDeleteId(null);
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
    <Sheet open={open} onClose={handleClose} title="จัดการประเภทห้อง">
      <div className="grid gap-4">
        <p className="text-pretty text-sm text-ink-muted">
          ประเภทห้อง (เช่น ห้องนวดเดี่ยว, ห้องสปา) ใช้ตอนสร้างห้องและตั้งค่าบริการว่าต้องใช้ห้องแบบไหน — ลบได้
          เฉพาะประเภทที่ไม่มีห้องหรือบริการอ้างอิงอยู่แล้วเท่านั้น
        </p>

        {error && (
          <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อประเภทห้องใหม่..."
            aria-label="ชื่อประเภทห้องใหม่"
            className="h-11 flex-1 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
          />
          <Button
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            + เพิ่ม
          </Button>
        </div>

        {listQuery.isLoading && (
          <SkeletonGroup label="กำลังโหลดประเภทห้อง">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </SkeletonGroup>
        )}

        {listQuery.isSuccess && listQuery.data.length === 0 && (
          <p className="text-pretty text-sm text-ink-muted">ยังไม่มีประเภทห้องในสาขานี้ — เพิ่มด้านบนได้เลย</p>
        )}

        {listQuery.isSuccess && listQuery.data.length > 0 && (
          <ul className="grid gap-2">
            {listQuery.data.map((rt) => (
              <li key={rt.id} className="flex items-center gap-2 rounded-DEFAULT border border-line p-2">
                {editingId === rt.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      aria-label={`แก้ชื่อ ${rt.name}`}
                      className="h-9 flex-1 rounded-DEFAULT border border-line-strong bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
                    />
                    <Button
                      size="sm"
                      disabled={!editingName.trim() || updateMutation.isPending}
                      onClick={() => updateMutation.mutate(rt)}
                    >
                      บันทึก
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      ยกเลิก
                    </Button>
                  </>
                ) : confirmingDeleteId === rt.id ? (
                  <>
                    <span className="flex-1 text-xs text-ink-muted">ลบ &quot;{rt.name}&quot; เลยไหม?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(rt.id)}
                    >
                      ยืนยันลบ
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingDeleteId(null)}>
                      ไม่ใช่
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-ink">{rt.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(rt.id);
                        setEditingName(rt.name);
                      }}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose hover:bg-rose-tint"
                      onClick={() => setConfirmingDeleteId(rt.id)}
                    >
                      ลบ
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="ghost" onClick={handleClose}>
            ปิด
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

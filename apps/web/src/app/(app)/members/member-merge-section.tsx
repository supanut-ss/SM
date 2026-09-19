"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Skeleton } from "@lotus-desk/ui";
import { ApiError, memberApi, type Member } from "../../../lib/api-client";

/**
 * รวมสมาชิกซ้ำ (T3.4) ในชีทแก้ไขสมาชิก — ใช้เมื่อสร้างสมาชิกซ้ำโดยไม่ตั้งใจ (เบอร์ซ้ำแล้วยืนยันสร้างต่อ
 * ตอน T3.1) ค้นหา "สมาชิกหลัก" ที่จะรวมเข้า แล้วต้องยืนยันอีกขั้นตาม DESIGN.md §7 เพราะปิดใช้งานสมาชิกรอง
 * ทันทีและย้ายประวัติ PDPA ไปหาสมาชิกหลัก — ย้อนกลับด้วยหน้านี้ไม่ได้ (ย้อนได้เฉพาะผ่าน audit log)
 */
export function MemberMergeSection({
  branchId,
  member,
  onMerged,
}: {
  branchId: string;
  member: Member;
  onMerged: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const primaryQuery = useQuery({
    queryKey: ["member", branchId, member.mergedIntoId],
    queryFn: () => memberApi.get(branchId, member.mergedIntoId!),
    enabled: !!member.mergedIntoId,
  });

  const searchQuery = useQuery({
    queryKey: ["members-merge-search", branchId, debouncedQuery],
    queryFn: () => memberApi.list(branchId, { q: debouncedQuery, isActive: "true" }),
    enabled: debouncedQuery.length > 0 && !member.mergedIntoId,
  });

  const mergeMutation = useMutation({
    mutationFn: (primaryMemberId: string) =>
      memberApi.merge(branchId, member.id, { primaryMemberId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", branchId] });
      onMerged();
    },
  });

  if (member.mergedIntoId) {
    return (
      <div className="grid gap-2 border-t border-line pt-4">
        <span className="text-sm font-medium text-ink">รวมสมาชิกซ้ำ</span>
        <p className="text-pretty rounded-DEFAULT bg-surface-sunk px-3 py-2 text-sm text-ink-muted">
          สมาชิกนี้ถูกรวมเข้ากับ{" "}
          {primaryQuery.isLoading
            ? "..."
            : primaryQuery.data
              ? `${primaryQuery.data.name} (${primaryQuery.data.code})`
              : "สมาชิกอื่น"}{" "}
          แล้ว — ไม่สามารถแก้ไขหรือรวมซ้ำได้อีก
        </p>
      </div>
    );
  }

  const candidates = (searchQuery.data ?? []).filter((m) => m.id !== member.id && !m.mergedIntoId);

  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <span className="text-sm font-medium text-ink">รวมสมาชิกซ้ำ</span>
      <p className="text-pretty text-xs text-ink-muted">
        ใช้เมื่อพบว่าสมาชิกคนนี้ถูกสร้างซ้ำโดยไม่ตั้งใจ — ประวัติความยินยอมจะย้ายไปรวมกับสมาชิกหลักที่เลือก
        แล้วสมาชิกนี้จะถูกปิดใช้งาน
      </p>

      {!selected && (
        <>
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="ค้นหาชื่อหรือเบอร์โทรของสมาชิกหลัก..."
            aria-label="ค้นหาสมาชิกหลักที่จะรวมเข้า"
          />
          {searchQuery.isLoading && (
            <Skeleton className="h-4 w-24" role="status" aria-label="กำลังค้นหา" />
          )}
          {debouncedQuery && searchQuery.isSuccess && candidates.length === 0 && (
            <p className="text-pretty text-xs text-ink-muted">ไม่พบสมาชิกที่ตรงกับ &ldquo;{debouncedQuery}&rdquo;</p>
          )}
          {candidates.length > 0 && (
            <ul className="grid gap-1 rounded-DEFAULT border border-line p-1">
              {candidates.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className="flex w-full items-center justify-between rounded-DEFAULT px-2 py-1.5 text-left text-sm hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon"
                  >
                    <span className="font-medium text-ink">{m.name}</span>
                    <span className="font-data tabular-nums text-ink-muted">
                      {m.phone} · {m.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected && !confirming && (
        <div className="flex items-center justify-between gap-3 rounded-DEFAULT border border-line p-3">
          <div className="grid gap-0.5">
            <span className="text-xs text-ink-muted">จะรวมเข้ากับ</span>
            <span className="text-sm font-medium text-ink">
              {selected.name} ({selected.code})
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              เปลี่ยน
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              รวมสมาชิก
            </Button>
          </div>
        </div>
      )}

      {selected && confirming && (
        <div className="grid gap-3 rounded-DEFAULT border border-rose bg-rose-tint p-3">
          <p className="text-pretty text-sm text-rose">
            ยืนยันรวม &ldquo;{member.name}&rdquo; ({member.code}) เข้ากับ &ldquo;{selected.name}&rdquo; (
            {selected.code})? สมาชิก &ldquo;{member.name}&rdquo; จะถูกปิดใช้งาน
            และประวัติความยินยอมทั้งหมดจะย้ายไปที่ &ldquo;{selected.name}&rdquo; — ย้อนกลับด้วยหน้านี้ไม่ได้
          </p>
          {mergeMutation.isError && (
            <p role="alert" className="text-pretty text-sm text-rose">
              {mergeMutation.error instanceof ApiError
                ? mergeMutation.error.message
                : "รวมสมาชิกไม่สำเร็จ กรุณาลองใหม่"}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={mergeMutation.isPending}
              onClick={() => mergeMutation.mutate(selected.id)}
            >
              {mergeMutation.isPending ? "กำลังรวม..." : "ยืนยันรวมสมาชิก"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

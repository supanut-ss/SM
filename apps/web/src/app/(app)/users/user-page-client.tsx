"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  ErrorState,
  Sheet,
  Skeleton,
  SkeletonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lotus-desk/ui";
import { ApiError, userApi, type BranchUser } from "../../../lib/api-client";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";

/**
 * ตั้งรหัสผ่านใหม่ให้ user คนอื่นโดยตรง (T-ADR-059) — เห็นเฉพาะ owner (settings:manage) เพราะยังไม่มีระบบ
 * ส่งอีเมล reset ในโปรเจกต์นี้ ใช้แก้ปัญหา user ลืมรหัสผ่านแล้วเข้าระบบไม่ได้เอง (ดู docs/decisions.md
 * ADR-059) — รีเซ็ตแล้ว session เดิมของ user คนนั้นถูกเพิกถอนทั้งหมด (backend ทำให้อัตโนมัติ)
 */
export function UserPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "settings");

  const [resetTarget, setResetTarget] = useState<BranchUser | null>(null);

  const listQuery = useQuery({
    queryKey: ["branch-users", branch?.branchId],
    queryFn: () => userApi.list(branch!.branchId),
    enabled: !!branch?.branchId && canManage,
  });

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          title="ไม่มีสิทธิ์เข้าถึงหน้านี้"
          description="รีเซ็ตรหัสผ่านผู้ใช้ทำได้เฉพาะเจ้าของร้าน — ถ้าจำเป็นต้องใช้งาน ให้ติดต่อเจ้าของร้าน"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-balance font-display text-2xl font-semibold text-ink">รีเซ็ตรหัสผ่านผู้ใช้</h1>
        <p className="text-pretty mt-2 text-sm leading-6 text-ink-muted">
          ตั้งรหัสผ่านใหม่ให้ผู้ใช้ที่เข้าระบบไม่ได้ — ไม่ต้องรู้รหัสผ่านเดิม เมื่อรีเซ็ตแล้วผู้ใช้คนนั้นจะถูก
          ออกจากระบบทุกอุปกรณ์ทันที
        </p>
      </div>

      {listQuery.isLoading && (
        <SkeletonGroup label="กำลังโหลดรายชื่อผู้ใช้">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </SkeletonGroup>
      )}

      {listQuery.isError && (
        <ErrorState
          title="โหลดรายชื่อผู้ใช้ไม่สำเร็จ"
          description={listQuery.error instanceof ApiError ? listQuery.error.message : undefined}
          action={<Button onClick={() => void listQuery.refetch()}>ลองใหม่</Button>}
        />
      )}

      {listQuery.isSuccess && listQuery.data.length === 0 && (
        <EmptyState title="ยังไม่มีผู้ใช้ในสาขานี้" description="เพิ่มพนักงานก่อนถึงจะมีบัญชีผู้ใช้ให้จัดการ" />
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell className="text-ink-muted">{u.email}</TableCell>
                <TableCell>{u.roleName}</TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setResetTarget(u)}>
                    ตั้งรหัสผ่านใหม่
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ResetPasswordSheet
        target={resetTarget}
        branchId={branch?.branchId ?? ""}
        onClose={() => setResetTarget(null)}
        onReset={() => void queryClient.invalidateQueries({ queryKey: ["branch-users", branch?.branchId] })}
      />
    </div>
  );
}

function ResetPasswordSheet({
  target,
  branchId,
  onClose,
  onReset,
}: {
  target: BranchUser | null;
  branchId: string;
  onClose: () => void;
  onReset: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resetMutation = useMutation({
    mutationFn: () => userApi.resetPassword(branchId, target!.id, { newPassword }),
    onSuccess: () => {
      setError(null);
      setDone(true);
      onReset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่"),
  });

  function handleClose() {
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setDone(false);
    onClose();
  }

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <Sheet open={!!target} onClose={handleClose} title={target ? `ตั้งรหัสผ่านใหม่ — ${target.name}` : ""}>
      {target && !done && (
        <div className="grid gap-4">
          <p className="text-pretty text-sm text-ink-muted">
            รหัสผ่านใหม่สำหรับ {target.email} — ผู้ใช้คนนี้จะถูกออกจากระบบทุกอุปกรณ์ทันทีหลังตั้งรหัสผ่านใหม่
          </p>
          {error && (
            <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}
          <div className="grid gap-1.5">
            <label htmlFor="reset-new-password" className="text-xs font-medium text-ink-muted">
              รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
            </label>
            <input
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="reset-confirm-password" className="text-xs font-medium text-ink-muted">
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
            />
            {mismatch && <p className="text-pretty text-xs text-rose">รหัสผ่านไม่ตรงกัน</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={handleClose}>
              ยกเลิก
            </Button>
            <Button
              disabled={!canSubmit || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
            >
              ยืนยันตั้งรหัสผ่านใหม่
            </Button>
          </div>
        </div>
      )}

      {target && done && (
        <div className="grid gap-4">
          <p className="text-pretty rounded-DEFAULT border border-line bg-celadon-tint px-3 py-2 text-sm text-ink">
            ตั้งรหัสผ่านใหม่ให้ {target.name} สำเร็จแล้ว — แจ้งรหัสผ่านใหม่ให้เจ้าตัวทางที่ปลอดภัย
            (ไม่แนะนำส่งผ่านแชท/ข้อความที่ไม่เข้ารหัส)
          </p>
          <div className="flex justify-end">
            <Button onClick={handleClose}>เสร็จสิ้น</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

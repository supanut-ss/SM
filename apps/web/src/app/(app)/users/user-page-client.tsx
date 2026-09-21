"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ROLE_DEFINITIONS } from "@lotus-desk/contracts";
import {
  Button,
  EmptyState,
  ErrorState,
  Select,
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
 * เพิ่ม/แก้ไข/ปิดใช้งาน/ตั้งรหัสผ่านใหม่ให้ user (T-ADR-059, T-ADR-060) — เห็นเฉพาะ owner (settings:manage)
 * "ลบ" ในหน้านี้คือปิดใช้งาน (isActive: false) ไม่ใช่ลบแถวจริง ตรงกับ pattern เดิมของ
 * staff/room/service ทั้งระบบ (กันประวัติ/บิล/ใบงานเก่าที่อ้างอิง user คนนี้พังไปด้วย)
 */
export function UserPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "settings");

  const [sheetTarget, setSheetTarget] = useState<"create" | BranchUser | null>(null);
  const [resetTarget, setResetTarget] = useState<BranchUser | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["branch-users", branch?.branchId],
    queryFn: () => userApi.list(branch!.branchId, { isActive: "all" }),
    enabled: !!branch?.branchId && canManage,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      userApi.update(branch!.branchId, userId, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branch-users", branch?.branchId] });
      setConfirmingDeactivateId(null);
    },
  });

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          title="ไม่มีสิทธิ์เข้าถึงหน้านี้"
          description="จัดการผู้ใช้ทำได้เฉพาะเจ้าของร้าน — ถ้าจำเป็นต้องใช้งาน ให้ติดต่อเจ้าของร้าน"
        />
      </div>
    );
  }

  function renderActions(u: BranchUser): ReactNode {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setSheetTarget(u)}>
          แก้ไข
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setResetTarget(u)}>
          ตั้งรหัสผ่านใหม่
        </Button>
        {confirmingDeactivateId === u.id ? (
          <>
            <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={toggleActiveMutation.isPending}
              onClick={() => toggleActiveMutation.mutate({ userId: u.id, isActive: false })}
            >
              ปิดใช้งาน
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivateId(null)}>
              ไม่ใช่
            </Button>
          </>
        ) : u.isActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-rose hover:bg-rose-tint"
            onClick={() => setConfirmingDeactivateId(u.id)}
          >
            ปิดใช้งาน
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={toggleActiveMutation.isPending}
            onClick={() => toggleActiveMutation.mutate({ userId: u.id, isActive: true })}
          >
            เปิดใช้งานอีกครั้ง
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-balance font-display text-2xl font-semibold text-ink">จัดการผู้ใช้</h1>
          <p className="text-pretty mt-2 text-sm leading-6 text-ink-muted">
            เพิ่ม/แก้ไข/ปิดใช้งานบัญชีผู้ใช้ และตั้งรหัสผ่านใหม่ให้ผู้ใช้ที่เข้าระบบไม่ได้ — ปิดใช้งานหรือ
            ตั้งรหัสผ่านใหม่แล้ว ผู้ใช้คนนั้นจะถูกออกจากระบบทุกอุปกรณ์ทันที
          </p>
        </div>
        <Button onClick={() => setSheetTarget("create")}>+ เพิ่มผู้ใช้</Button>
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
        <EmptyState title="ยังไม่มีผู้ใช้ในสาขานี้" description="กด + เพิ่มผู้ใช้ เพื่อสร้างบัญชีแรก" />
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell className="text-ink-muted">{u.email}</TableCell>
                <TableCell>{u.roleName}</TableCell>
                <TableCell>
                  <span
                    className={
                      u.isActive
                        ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                        : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                    }
                  >
                    {u.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                  </span>
                </TableCell>
                <TableCell className="flex flex-wrap justify-end gap-1 text-right">
                  {renderActions(u)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UserFormSheet
        target={sheetTarget}
        branchId={branch?.branchId ?? ""}
        onClose={() => setSheetTarget(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["branch-users", branch?.branchId] })}
      />

      <ResetPasswordSheet
        target={resetTarget}
        branchId={branch?.branchId ?? ""}
        onClose={() => setResetTarget(null)}
        onReset={() => void queryClient.invalidateQueries({ queryKey: ["branch-users", branch?.branchId] })}
      />
    </div>
  );
}

function UserFormSheet({
  target,
  branchId,
  onClose,
  onSaved,
}: {
  target: "create" | BranchUser | null;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingRecord = target && target !== "create" ? target : null;
  const isCreate = target === "create";

  const [email, setEmail] = useState(editingRecord?.email ?? "");
  const [name, setName] = useState(editingRecord?.name ?? "");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState(editingRecord?.roleKey ?? ROLE_DEFINITIONS[0].key);
  const [error, setError] = useState<string | null>(null);

  // sync ค่าเริ่มต้นเมื่อเปลี่ยน target (เปิดชีทแก้ไขคนละคน) — เขียนตรงนี้แทน useEffect เพราะ Sheet
  // unmount/remount ทุกครั้งที่ target เปลี่ยนอยู่แล้วจาก key ด้านล่าง ไม่ต้องกังวลเรื่อง stale state
  const resetKey = editingRecord?.id ?? (isCreate ? "create" : "closed");

  const createMutation = useMutation({
    mutationFn: () => userApi.create(branchId, { email, name, password, roleKey }),
    onSuccess: () => {
      setError(null);
      onSaved();
      handleClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "เพิ่มผู้ใช้ไม่สำเร็จ กรุณาลองใหม่"),
  });

  const updateMutation = useMutation({
    // ส่งเฉพาะ field ที่เปลี่ยนจริงเท่านั้น — user เดิมที่ seed ไว้บางคนยังมีชื่อภาษาไทย (เช่น "เจ้าของร้าน")
    // ถ้าส่ง name เดิมกลับไปทุกครั้งที่แก้ไข (แม้ไม่ได้ตั้งใจแก้ชื่อ) จะโดน regex ภาษาอังกฤษเท่านั้นปฏิเสธ
    // (400) ทำให้แก้ email/role/สถานะไม่ได้เลยแม้ไม่เกี่ยวกับชื่อ — ต้องแก้ชื่อเป็นภาษาอังกฤษเองก่อนถึงจะแก้
    // ชื่อได้ แต่ field อื่นแก้ได้อิสระโดยไม่ต้องยุ่งกับชื่อเดิม
    mutationFn: () => {
      const input: Record<string, string> = {};
      if (email !== editingRecord!.email) input.email = email;
      if (name !== editingRecord!.name) input.name = name;
      if (roleKey !== editingRecord!.roleKey) input.roleKey = roleKey;
      return userApi.update(branchId, editingRecord!.id, input);
    },
    onSuccess: () => {
      setError(null);
      onSaved();
      handleClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "แก้ไขผู้ใช้ไม่สำเร็จ กรุณาลองใหม่"),
  });

  function handleClose() {
    setEmail("");
    setName("");
    setPassword("");
    setRoleKey(ROLE_DEFINITIONS[0].key);
    setError(null);
    onClose();
  }

  const canSubmit = isCreate
    ? !!email && !!name && password.length >= 8 && !!roleKey
    : !!email && !!name && !!roleKey;

  return (
    <Sheet
      key={resetKey}
      open={!!target}
      onClose={handleClose}
      title={isCreate ? "เพิ่มผู้ใช้ใหม่" : `แก้ไขผู้ใช้ — ${editingRecord?.name}`}
    >
      {target && (
        <div className="grid gap-4">
          {error && (
            <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}
          <div className="grid gap-1.5">
            <label htmlFor="user-name" className="text-xs font-medium text-ink-muted">
              ชื่อ (ภาษาอังกฤษเท่านั้น — ใช้เข้าสู่ระบบแทนอีเมลได้ด้วย)
            </label>
            <input
              id="user-name"
              defaultValue={editingRecord?.name ?? ""}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น John, Somchai"
              className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="user-email" className="text-xs font-medium text-ink-muted">
              อีเมล
            </label>
            <input
              id="user-email"
              type="email"
              defaultValue={editingRecord?.email ?? ""}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
            />
          </div>
          {isCreate && (
            <div className="grid gap-1.5">
              <label htmlFor="user-password" className="text-xs font-medium text-ink-muted">
                รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัวอักษร)
              </label>
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:h-9 lg:text-sm"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor="user-role" className="text-xs font-medium text-ink-muted">
              บทบาท
            </label>
            <Select
              id="user-role"
              defaultValue={editingRecord?.roleKey ?? ROLE_DEFINITIONS[0].key}
              onChange={(e) => setRoleKey(e.target.value)}
            >
              {ROLE_DEFINITIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={handleClose}>
              ยกเลิก
            </Button>
            <Button
              disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
              onClick={() => (isCreate ? createMutation.mutate() : updateMutation.mutate())}
            >
              {isCreate ? "เพิ่มผู้ใช้" : "บันทึก"}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
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

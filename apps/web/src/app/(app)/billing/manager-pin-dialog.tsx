"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Label, Select, Sheet } from "@lotus-desk/ui";
import { ApiError, authApi, userApi } from "../../../lib/api-client";

// ผู้อนุมัติต้องเป็น owner/manager เท่านั้น — ตรงกับ APPROVER_ROLE_KEYS ฝั่ง AuthService.verifyManagerPin
// (ดู docs/decisions.md ADR-030) เช็คซ้ำแค่ระดับ UI เพื่อไม่ให้เลือกคนที่ยิงไปแล้วโดนปฏิเสธแน่ ๆ
// สิทธิ์จริงบังคับที่ backend เสมอ
const APPROVER_ROLE_KEYS = new Set(["owner", "manager"]);

/**
 * ชีทกรอก PIN ผู้จัดการแบบใช้ซ้ำได้ (T5.6) — เรียก POST /auth/verify-manager-pin แล้วส่ง approvalToken
 * อายุสั้นมากกลับผ่าน onApproved ให้ผู้เรียกแนบไปกับ endpoint ที่ต้องมี PIN ผู้จัดการ (ตอนนี้มีแค่ยกเลิกบิล)
 */
export function ManagerPinDialog({
  open,
  onClose,
  branchId,
  title = "ยืนยัน PIN ผู้จัดการ",
  description,
  onApproved,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
  title?: string;
  description?: string;
  onApproved: (approvalToken: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["branch-users", branchId],
    queryFn: () => userApi.list(branchId),
    enabled: open,
  });

  const approvers = (usersQuery.data ?? []).filter((u) => APPROVER_ROLE_KEYS.has(u.roleKey));

  function handleClose() {
    setUserId("");
    setPin("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { approvalToken } = await authApi.verifyManagerPin({ branchId, userId, pin });
      setUserId("");
      setPin("");
      onApproved(approvalToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ยืนยัน PIN ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title={title} description={description}>
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="approver">ผู้จัดการที่จะอนุมัติ</Label>
          {usersQuery.isLoading && <p className="text-sm text-ink-muted">กำลังโหลด...</p>}
          {usersQuery.isSuccess && approvers.length === 0 && (
            <p className="text-xs text-brass">สาขานี้ยังไม่มีผู้จัดการหรือเจ้าของร้านที่ใช้งานอยู่</p>
          )}
          {approvers.length > 0 && (
            <Select
              id="approver"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              required
            >
              <option value="" disabled>
                -- เลือกผู้จัดการ --
              </option>
              {approvers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleName})
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="approver-pin">PIN 6 หลัก</Label>
          <Input
            id="approver-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </div>

        {error && (
          <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={handleClose}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isSubmitting || !userId || pin.length !== 6}>
            {isSubmitting ? "กำลังยืนยัน..." : "ยืนยัน PIN"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label } from "@lotus-desk/ui";
import { ApiError, couponApi } from "../../../lib/api-client";

/** คูปองของโปรโมชั่น (T5.4) — โปรฯ ที่มีคูปองผูกอย่างน้อย 1 ใบ จะกลายเป็น "ต้องกรอกรหัสคูปอง" ในหน้าคำนวณ */
export function CouponSection({ branchId, promotionId }: { branchId: string; promotionId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const couponsKey = ["coupons", branchId, promotionId];
  const couponsQuery = useQuery({
    queryKey: couponsKey,
    queryFn: () => couponApi.list(branchId, promotionId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      couponApi.create(branchId, promotionId, {
        code,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: couponsKey });
      setCreating(false);
      setCode("");
      setMaxRedemptions("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "สร้างคูปองไม่สำเร็จ กรุณาลองใหม่"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ couponId, isActive }: { couponId: string; isActive: boolean }) =>
      couponApi.update(branchId, promotionId, couponId, { isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: couponsKey }),
  });

  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">คูปอง</span>
        {!creating && (
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            + เพิ่มคูปอง
          </Button>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        ถ้าโปรฯ นี้มีคูปองอย่างน้อย 1 ใบ จะใช้ได้เฉพาะตอนกรอกรหัสคูปองที่ตรงเท่านั้น (ไม่ใช่โปรฯ อัตโนมัติอีกต่อไป)
      </p>

      {error && (
        <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {creating && (
        <div className="grid gap-2 rounded-DEFAULT border border-line p-3">
          <Label htmlFor="coupon-code" className="text-xs font-normal">
            รหัสคูปอง
          </Label>
          <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER10" />
          <Label htmlFor="coupon-max" className="text-xs font-normal">
            จำนวนครั้งที่แลกได้ (เว้นว่าง = ไม่จำกัด)
          </Label>
          <Input
            id="coupon-max"
            type="number"
            min={1}
            step={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" disabled={!code || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </div>
        </div>
      )}

      {couponsQuery.isLoading && <p className="text-xs text-ink-muted">กำลังโหลด...</p>}
      {couponsQuery.isSuccess && couponsQuery.data.length === 0 && (
        <p className="text-xs text-ink-muted">ยังไม่มีคูปองผูกกับโปรฯ นี้ (ใช้ได้อัตโนมัติถ้าเข้าเงื่อนไข)</p>
      )}

      <div className="grid gap-2">
        {(couponsQuery.data ?? []).map((coupon) => (
          <div key={coupon.id} className="flex items-center justify-between rounded-DEFAULT border border-line p-2">
            <div className="grid gap-0.5">
              <span className="font-data text-sm text-ink">{coupon.code}</span>
              <span className="text-xs text-ink-muted">
                ใช้แล้ว {coupon.redeemedCount}
                {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""} ครั้ง
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate({ couponId: coupon.id, isActive: !coupon.isActive })}
            >
              {coupon.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

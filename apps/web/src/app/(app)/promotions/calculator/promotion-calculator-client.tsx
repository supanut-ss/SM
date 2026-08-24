"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LINE_PAYMENT_METHOD_LABEL, LINE_PAYMENT_METHODS, type LinePaymentMethod } from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import { ApiError, promotionCalculatorApi, serviceApi, type CalculatePromotionsResult } from "../../../../lib/api-client";
import { formatSatang } from "../../../../lib/format-money";
import { useCurrentBranch } from "../../current-branch-context";

interface CartLineDraft {
  serviceVariantId: string;
  serviceLabel: string;
  priceBaht: number;
  paymentMethod: LinePaymentMethod;
  quantity: number;
}

/**
 * หน้าทดลองคำนวณโปรโมชั่น (T5.4) — "ใส่ตะกร้าจำลองแล้วดูว่าโปรฯ ไหนจับ ลดเท่าไร เพราะอะไร" ไม่บันทึกอะไร
 * ลง DB เลย เรียก POST /promotions/calculate ตรง ๆ (ห่อ evaluatePromotions ของ T5.3 จริง) แสดงเหตุผลของ
 * ทุกโปรฯ ที่พิจารณาแล้ว ทั้งที่ถูกเลือกและไม่ถูกเลือก (เกณฑ์ผ่าน T5.4: "อธิบายเหตุผลได้ทุกบรรทัด")
 */
export function PromotionCalculatorClient() {
  const branch = useCurrentBranch();
  const [cart, setCart] = useState<CartLineDraft[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [memberTier, setMemberTier] = useState("");
  const [isFirstTimeCustomer, setIsFirstTimeCustomer] = useState(false);
  const [memberBirthMonth, setMemberBirthMonth] = useState("");
  const [result, setResult] = useState<CalculatePromotionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services", branch?.branchId, "", "true"],
    queryFn: () => serviceApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });
  const allVariants = (servicesQuery.data ?? []).flatMap((s) =>
    s.variants.map((v) => ({ ...v, serviceName: s.name })),
  );

  const calculateMutation = useMutation({
    mutationFn: () =>
      promotionCalculatorApi.calculate(branch!.branchId, {
        couponCode: couponCode || undefined,
        memberTier: memberTier || undefined,
        isFirstTimeCustomer,
        memberBirthMonth: memberBirthMonth ? Number(memberBirthMonth) : undefined,
        cart: cart.map((line) => ({
          serviceVariantId: line.serviceVariantId,
          priceSatang: Math.round(line.priceBaht * 100),
          paymentMethod: line.paymentMethod,
          quantity: line.quantity,
        })),
      }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "คำนวณไม่สำเร็จ กรุณาลองใหม่"),
  });

  function addLine() {
    const first = allVariants[0];
    if (!first) return;
    setCart((prev) => [
      ...prev,
      {
        serviceVariantId: first.id,
        serviceLabel: `${first.serviceName} · ${first.durationMin} นาที`,
        priceBaht: first.priceSatang / 100,
        paymentMethod: "CASH",
        quantity: 1,
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<CartLineDraft>) {
    setCart((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
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
    <div className="grid gap-6 p-8 lg:grid-cols-2">
      <div className="grid gap-6">
        <div>
          <Link href="/promotions" className="text-sm text-ink-muted underline-offset-2 hover:underline">
            ← กลับไปหน้าโปรโมชั่น
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">ทดลองคำนวณโปรโมชั่น</h1>
          <p className="mt-1 text-sm text-ink-muted">
            ใส่ตะกร้าจำลองแล้วดูว่าโปรฯ ไหนจับ ลดเท่าไร เพราะอะไร — ไม่มีการบันทึกอะไรลงระบบจริง
          </p>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">ตะกร้าจำลอง</span>
            <Button variant="secondary" size="sm" onClick={addLine} disabled={allVariants.length === 0}>
              + เพิ่มรายการ
            </Button>
          </div>

          {allVariants.length === 0 && (
            <p className="text-xs text-brass">สาขานี้ยังไม่มีบริการที่เปิดขายเลย — เพิ่มบริการก่อน</p>
          )}
          {cart.length === 0 && allVariants.length > 0 && (
            <p className="text-xs text-ink-muted">ยังไม่มีรายการในตะกร้าจำลอง</p>
          )}

          {cart.map((line, index) => (
            <div key={index} className="grid gap-2 rounded-DEFAULT border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <Select
                  aria-label="บริการ"
                  value={line.serviceVariantId}
                  onChange={(e) => {
                    const v = allVariants.find((x) => x.id === e.target.value);
                    if (!v) return;
                    updateLine(index, {
                      serviceVariantId: v.id,
                      serviceLabel: `${v.serviceName} · ${v.durationMin} นาที`,
                      priceBaht: v.priceSatang / 100,
                    });
                  }}
                  className="flex-1"
                >
                  {allVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.serviceName} · {v.durationMin} นาที
                    </option>
                  ))}
                </Select>
                <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                  ลบ
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs font-normal">ราคา (บาท)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={line.priceBaht}
                    onChange={(e) => updateLine(index, { priceBaht: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-normal">จำนวน</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-normal">ชำระด้วย</Label>
                  <Select
                    value={line.paymentMethod}
                    onChange={(e) => updateLine(index, { paymentMethod: e.target.value as LinePaymentMethod })}
                  >
                    {LINE_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {LINE_PAYMENT_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-t border-line pt-4">
          <span className="text-sm font-medium text-ink">ข้อมูลสมาชิก (จำลอง)</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="calc-tier" className="text-xs font-normal">
                ระดับสมาชิก
              </Label>
              <Input id="calc-tier" value={memberTier} onChange={(e) => setMemberTier(e.target.value)} placeholder="เช่น GOLD" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="calc-birth-month" className="text-xs font-normal">
                เดือนเกิด
              </Label>
              <Select id="calc-birth-month" value={memberBirthMonth} onChange={(e) => setMemberBirthMonth(e.target.value)}>
                <option value="">ไม่ระบุ</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    เดือน {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isFirstTimeCustomer} onChange={(e) => setIsFirstTimeCustomer(e.target.checked)} />
            ลูกค้าใหม่ครั้งแรก
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor="calc-coupon" className="text-xs font-normal">
              รหัสคูปอง (ไม่บังคับ)
            </Label>
            <Input id="calc-coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="เช่น SUMMER10" />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}

        <Button
          disabled={cart.length === 0 || calculateMutation.isPending}
          onClick={() => calculateMutation.mutate()}
        >
          {calculateMutation.isPending ? "กำลังคำนวณ..." : "คำนวณ"}
        </Button>
      </div>

      <div className="grid gap-4">
        <span className="text-sm font-medium text-ink">ผลลัพธ์</span>

        {!result && <p className="text-sm text-ink-muted">กรอกตะกร้าจำลองแล้วกดคำนวณเพื่อดูผล</p>}

        {result && (
          <div className="grid gap-4">
            {result.couponError && (
              <p className="rounded-DEFAULT bg-brass-tint px-3 py-2 text-sm text-brass">{result.couponError}</p>
            )}

            {result.applied ? (
              <div className="rounded-DEFAULT border border-celadon bg-celadon-tint p-4">
                <p className="text-xs font-medium text-celadon">โปรฯ ที่ระบบเลือกให้</p>
                <p className="mt-1 text-lg font-semibold text-ink">{result.applied.promotionName}</p>
                <p className="font-data tabular-nums text-sm text-ink">
                  {result.applied.discountSatang > 0 && `ลด ${formatSatang(result.applied.discountSatang)}`}
                  {result.applied.bonusMinutes > 0 && `แถม ${result.applied.bonusMinutes} นาที`}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{result.applied.reason}</p>
              </div>
            ) : (
              <p className="rounded-DEFAULT border border-dashed border-line-strong p-4 text-sm text-ink-muted">
                ไม่มีโปรโมชั่นที่ใช้ได้กับตะกร้านี้
              </p>
            )}

            {result.rejected.length > 0 && (
              <div className="grid gap-2">
                <span className="text-xs font-medium text-ink-muted">โปรฯ ที่ไม่ถูกเลือก (เพราะอะไร)</span>
                {result.rejected.map((r) => (
                  <div key={r.promotionId} className="rounded-DEFAULT border border-line p-3">
                    <p className="text-sm text-ink">{r.promotionName}</p>
                    <p className="text-xs text-ink-muted">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

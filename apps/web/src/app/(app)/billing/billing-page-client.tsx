"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import {
  ApiError,
  appointmentItemApi,
  billApi,
  memberApi,
  promotionCalculatorApi,
  type AppointmentItem,
  type Bill,
} from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { startOfToday, toDateKey } from "../board/date-format";
import { useCurrentBranch } from "../current-branch-context";
import { BillHistory } from "./bill-history";
import { CashierShiftPanel } from "./cashier-shift-panel";
import { Receipt } from "./receipt";

interface ProductLineDraft {
  key: string;
  description: string;
  priceBaht: number;
  quantity: number;
  paymentMethod: PaymentMethod;
}

interface PaymentDraft {
  key: string;
  method: PaymentMethod;
  amountBaht: number;
  tenderedBaht: number | "";
}

interface PreviewResult {
  discountSatang: number;
  reason: string | null;
  couponError: string | null;
}

function randomKey(): string {
  return Math.random().toString(36).slice(2);
}

const EMPTY_PRODUCT_DRAFT = { description: "", priceBaht: 0, quantity: 1, paymentMethod: "CASH" as PaymentMethod };

/**
 * แคชเชียร์ (T5.6) — ฝั่งซ้าย: ใบงานที่จบงานแล้วแต่ยังไม่ออกบิลของวันนี้ (จาก AppointmentItemController.list
 * ที่ตอนนี้ include billLine มาด้วยแล้ว) ฝั่งขวา: ตะกร้าบิล + คำนวณส่วนลด (เรียก engine เดียวกับหน้าทดลอง
 * คำนวณ T5.4 ผ่าน promotionCalculatorApi ก่อน แล้วค่อยส่ง checkout จริง — ตัวเลขฝั่ง client ใช้แค่แสดงผล
 * ตัดสินใจสุดท้ายอยู่ที่ server เสมอ (ห้าม trust ตัวเลขเงินจาก client ดู CLAUDE.md)
 */
export function BillingPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();

  const [date] = useState(() => startOfToday());
  const dateKey = toDateKey(date);

  const [cartJobIds, setCartJobIds] = useState<string[]>([]);
  const [productLines, setProductLines] = useState<ProductLineDraft[]>([]);
  const [productDraft, setProductDraft] = useState(EMPTY_PRODUCT_DRAFT);
  const [memberFilter, setMemberFilter] = useState("");
  const [memberId, setMemberId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [memberTier, setMemberTier] = useState("");
  const [isFirstTimeCustomer, setIsFirstTimeCustomer] = useState(false);
  const [memberBirthMonth, setMemberBirthMonth] = useState<number | "">("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null);

  const itemsQuery = useQuery({
    queryKey: ["appointment-items", branch?.branchId, dateKey],
    queryFn: () => appointmentItemApi.list(branch!.branchId, dateKey),
    enabled: !!branch?.branchId,
  });

  const membersQuery = useQuery({
    queryKey: ["members", branch?.branchId, "", "true"],
    queryFn: () => memberApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const readyItems = useMemo(
    () =>
      (itemsQuery.data ?? []).filter(
        (item): item is AppointmentItem & { serviceJob: NonNullable<AppointmentItem["serviceJob"]> } =>
          !!item.serviceJob && !!item.serviceJob.completedAt && !item.serviceJob.billLine,
      ),
    [itemsQuery.data],
  );

  const cartJobs = useMemo(
    () => readyItems.filter((item) => cartJobIds.includes(item.serviceJob.id)),
    [readyItems, cartJobIds],
  );

  function resetPreview() {
    setPreview(null);
    setPayments([]);
    setCheckoutError(null);
  }

  function toggleJob(item: (typeof readyItems)[number]) {
    const jobId = item.serviceJob.id;
    setCartJobIds((prev) => (prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]));
    resetPreview();
  }

  function addProductLine() {
    if (!productDraft.description.trim() || productDraft.priceBaht <= 0 || productDraft.quantity < 1) return;
    setProductLines((prev) => [...prev, { key: randomKey(), ...productDraft }]);
    setProductDraft(EMPTY_PRODUCT_DRAFT);
    resetPreview();
  }

  function removeProductLine(key: string) {
    setProductLines((prev) => prev.filter((p) => p.key !== key));
    resetPreview();
  }

  const subtotalSatang = useMemo(() => {
    const jobsSubtotal = cartJobs.reduce((sum, item) => sum + item.serviceJob.priceSatang, 0);
    const productsSubtotal = productLines.reduce(
      (sum, p) => sum + Math.round(p.priceBaht * 100) * p.quantity,
      0,
    );
    return jobsSubtotal + productsSubtotal;
  }, [cartJobs, productLines]);

  const totalSatang = subtotalSatang - (preview?.discountSatang ?? 0);
  const paymentsTotalSatang = payments.reduce((sum, p) => sum + Math.round(p.amountBaht * 100), 0);

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase();
    const list = membersQuery.data ?? [];
    if (!q) return list;
    return list.filter(
      (m) => m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.code.toLowerCase().includes(q),
    );
  }, [membersQuery.data, memberFilter]);

  const cartHasEmptyContent = cartJobs.length === 0 && productLines.length === 0;
  const packageLinesMissingMember = cartJobs.some(
    (item) => item.serviceJob.paymentMethod === "PACKAGE" && !memberId,
  );

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const cart = [
        ...cartJobs.map((item) => ({
          serviceVariantId: item.serviceVariant.id,
          priceSatang: item.serviceJob.priceSatang,
          paymentMethod: item.serviceJob.paymentMethod!,
          quantity: 1,
        })),
        ...productLines.map((p) => ({
          serviceVariantId: `product:${p.description}`,
          priceSatang: Math.round(p.priceBaht * 100),
          paymentMethod: p.paymentMethod,
          quantity: p.quantity,
        })),
      ];
      return promotionCalculatorApi.calculate(branch!.branchId, {
        cart,
        couponCode: couponCode.trim() || undefined,
        memberTier: memberTier.trim() || undefined,
        isFirstTimeCustomer,
        memberBirthMonth: memberBirthMonth === "" ? undefined : memberBirthMonth,
      });
    },
    onSuccess: (result) => {
      setPreview({
        discountSatang: result.applied?.discountSatang ?? 0,
        reason: result.applied?.reason ?? null,
        couponError: result.couponError,
      });
      setPayments([]);
    },
    onError: (err) => {
      setCheckoutError(err instanceof ApiError ? err.message : "คำนวณยอดไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      billApi.checkout(branch!.branchId, {
        memberId: memberId || undefined,
        serviceJobLines: cartJobs.map((item) => ({
          serviceJobId: item.serviceJob.id,
        })),
        productLines: productLines.map((p) => ({
          description: p.description,
          priceSatang: Math.round(p.priceBaht * 100),
          quantity: p.quantity,
          paymentMethod: p.paymentMethod,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amountSatang: Math.round(p.amountBaht * 100),
          tenderedSatang: p.tenderedBaht === "" ? undefined : Math.round(p.tenderedBaht * 100),
        })),
        couponCode: couponCode.trim() || undefined,
        memberTier: memberTier.trim() || undefined,
        isFirstTimeCustomer,
        memberBirthMonth: memberBirthMonth === "" ? undefined : memberBirthMonth,
      }),
    onSuccess: (bill) => {
      setReceiptBill(bill);
      setCartJobIds([]);
      setProductLines([]);
      setMemberId("");
      setCouponCode("");
      resetPreview();
      void queryClient.invalidateQueries({ queryKey: ["appointment-items", branch?.branchId, dateKey] });
      void queryClient.invalidateQueries({ queryKey: ["bills", branch?.branchId] });
    },
    onError: (err) => {
      setCheckoutError(err instanceof ApiError ? err.message : "ออกบิลไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  /** เติมช่องทางชำระอัตโนมัติจากยอดจริงของแต่ละแหล่งชำระในตะกร้า แล้วหักส่วนลดออกจากกลุ่มที่ไม่ใช่ PACKAGE
   * กลุ่มแรกที่เจอ (โปรฯ ไม่มีทางแตะรายการ PACKAGE อยู่แล้ว ดู isPromotable ใน packages/core) — แคชเชียร์
   * แก้ตัวเลขต่อได้เองถ้าอยากจัดสรรส่วนลดให้ช่องทางอื่นแทน ระบบเช็คแค่ผลรวมต้องตรงยอดสุทธิตอนส่งจริง */
  function autofillPayments() {
    const groups = new Map<PaymentMethod, number>();
    for (const item of cartJobs) {
      const m = item.serviceJob.paymentMethod!;
      groups.set(m, (groups.get(m) ?? 0) + item.serviceJob.priceSatang);
    }
    for (const p of productLines) {
      groups.set(p.paymentMethod, (groups.get(p.paymentMethod) ?? 0) + Math.round(p.priceBaht * 100) * p.quantity);
    }
    let remainingDiscount = preview?.discountSatang ?? 0;
    const rows: PaymentDraft[] = [];
    for (const [method, amount] of groups) {
      let due = amount;
      if (remainingDiscount > 0 && method !== "PACKAGE") {
        const applied = Math.min(remainingDiscount, due);
        due -= applied;
        remainingDiscount -= applied;
      }
      if (due > 0) {
        rows.push({
          key: randomKey(),
          method,
          amountBaht: due / 100,
          tenderedBaht: method === "CASH" ? due / 100 : "",
        });
      }
    }
    setPayments(rows);
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, { key: randomKey(), method: "CASH", amountBaht: 0, tenderedBaht: "" }]);
  }

  function updatePaymentRow(key: string, patch: Partial<PaymentDraft>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function removePaymentRow(key: string) {
    setPayments((prev) => prev.filter((p) => p.key !== key));
  }

  const paymentsDiffSatang = totalSatang - paymentsTotalSatang;
  const canCheckout =
    !cartHasEmptyContent &&
    preview !== null &&
    !packageLinesMissingMember &&
    payments.length > 0 &&
    paymentsDiffSatang === 0;

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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">บิล/แคชเชียร์</h1>
        <p className="mt-1 text-sm text-ink-muted">ออกบิลรวมใบงานที่จบแล้วของวันนี้ + สินค้า ที่สาขา {branch.branchName}</p>
      </div>

      <CashierShiftPanel branchId={branch.branchId} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ฝั่งซ้าย — ใบงานที่พร้อมออกบิล */}
        <section aria-label="ใบงานที่พร้อมออกบิล">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">พร้อมออกบิลวันนี้</h2>

          {itemsQuery.isLoading && (
            <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายการ">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-DEFAULT bg-surface-sunk" />
              ))}
            </div>
          )}

          {itemsQuery.isError && (
            <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
              {itemsQuery.error instanceof ApiError ? itemsQuery.error.message : "โหลดรายการไม่สำเร็จ กรุณาลองใหม่"}
              <Button variant="secondary" size="sm" className="ml-3" onClick={() => void itemsQuery.refetch()}>
                ลองใหม่
              </Button>
            </div>
          )}

          {itemsQuery.isSuccess && readyItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
              <p className="text-sm text-ink-muted">
                ยังไม่มีใบงานที่จบแล้วรอออกบิล — ไปที่กระดานคิวแล้วเปลี่ยนสถานะนัดเป็น &quot;จบงาน&quot; ก่อน
              </p>
            </div>
          )}

          {itemsQuery.isSuccess && readyItems.length > 0 && (
            <ul className="grid gap-2">
              {readyItems.map((item) => {
                const inCart = cartJobIds.includes(item.serviceJob.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleJob(item)}
                      aria-pressed={inCart}
                      className={`flex w-full items-center justify-between gap-3 rounded-DEFAULT border px-4 py-3 text-left transition-colors ${
                        inCart
                          ? "border-celadon bg-celadon-tint"
                          : "border-line-strong bg-surface hover:bg-surface-sunk"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {item.serviceVariant.service.name} · {item.serviceVariant.durationMin} นาที
                        </p>
                        <p className="text-xs text-ink-muted">
                          {item.staff.name} · {item.appointment.member?.name ?? "ลูกค้า Walk-in"} ·{" "}
                          {PAYMENT_METHOD_LABEL[item.serviceJob.paymentMethod!]}
                        </p>
                      </div>
                      <span className="font-data text-sm tabular-nums text-ink">
                        {formatSatang(item.serviceJob.priceSatang)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ฝั่งขวา — ตะกร้าบิล */}
        <section aria-label="ตะกร้าบิล" className="grid gap-5">
          <div>
            <Label htmlFor="member-filter">สมาชิก (ไม่บังคับ ยกเว้นมีรายการตัดคอร์ส)</Label>
            <div className="mt-1.5 grid gap-2">
              <Input
                id="member-filter"
                placeholder="ค้นหาชื่อ/เบอร์/รหัสสมาชิก..."
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
              />
              <Select
                aria-label="เลือกสมาชิก"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">-- ไม่ระบุสมาชิก (walk-in) --</option>
                {filteredMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code}) · {m.phone}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">รายการในบิล</h3>
            {cartHasEmptyContent && <p className="text-sm text-ink-muted">ยังไม่มีรายการ — เลือกใบงานจากฝั่งซ้าย หรือเพิ่มสินค้าด้านล่าง</p>}
            <ul className="grid gap-2">
              {cartJobs.map((item) => {
                const isPackage = item.serviceJob.paymentMethod === "PACKAGE";
                return (
                  <li key={item.id} className="rounded-DEFAULT border border-line-strong bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-ink">
                        {item.serviceVariant.service.name} ({PAYMENT_METHOD_LABEL[item.serviceJob.paymentMethod!]})
                      </p>
                      <span className="font-data text-sm tabular-nums text-ink">
                        {formatSatang(item.serviceJob.priceSatang)}
                      </span>
                    </div>
                    {/* คอร์สที่จะตัดล็อกไว้ตั้งแต่ตอนเริ่มงานแล้ว (ดู docs/decisions.md ADR-046) — แสดงผลอย่าง
                        เดียว ไม่ให้เลือกซ้ำตอนออกบิลอีก */}
                    {isPackage && (
                      <p className="mt-2 text-xs text-ink-muted">
                        ตัดคอร์ส: {item.serviceJob.memberPackage?.name ?? "เลือกไว้ตอนเริ่มงาน"}
                      </p>
                    )}
                  </li>
                );
              })}
              {productLines.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2 rounded-DEFAULT border border-line-strong bg-surface p-3">
                  <div>
                    <p className="text-sm text-ink">
                      {p.description} {p.quantity > 1 ? `x${p.quantity}` : ""} ({PAYMENT_METHOD_LABEL[p.paymentMethod]})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-data text-sm tabular-nums text-ink">
                      {formatSatang(Math.round(p.priceBaht * 100) * p.quantity)}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeProductLine(p.key)}>
                      ลบ
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-DEFAULT border border-dashed border-line-strong p-3">
            <h3 className="mb-2 text-sm font-semibold text-ink">เพิ่มรายการสินค้า (ไม่ผูกคลัง)</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input
                aria-label="ชื่อสินค้า"
                placeholder="ชื่อสินค้า"
                value={productDraft.description}
                onChange={(event) => setProductDraft((prev) => ({ ...prev, description: event.target.value }))}
                className="col-span-2 sm:col-span-1"
              />
              <Input
                aria-label="ราคา (บาท)"
                type="number"
                min={0}
                step={0.01}
                placeholder="ราคา (บาท)"
                value={productDraft.priceBaht || ""}
                onChange={(event) => setProductDraft((prev) => ({ ...prev, priceBaht: Number(event.target.value) }))}
              />
              <Input
                aria-label="จำนวน"
                type="number"
                min={1}
                step={1}
                value={productDraft.quantity}
                onChange={(event) => setProductDraft((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
              />
              <Select
                aria-label="แหล่งชำระสินค้า"
                value={productDraft.paymentMethod}
                onChange={(event) =>
                  setProductDraft((prev) => ({ ...prev, paymentMethod: event.target.value as PaymentMethod }))
                }
              >
                {PAYMENT_METHODS.filter((m) => m !== "PACKAGE").map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addProductLine}>
              + เพิ่มรายการสินค้า
            </Button>
          </div>

          <details className="rounded-DEFAULT border border-dashed border-line-strong p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">ตัวเลือกโปรโมชั่น/สมาชิก</summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="coupon-code">รหัสคูปอง</Label>
                <Input
                  id="coupon-code"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value);
                    resetPreview();
                  }}
                />
              </div>
              <div>
                <Label htmlFor="member-tier">ระดับสมาชิก (tier)</Label>
                <Input
                  id="member-tier"
                  value={memberTier}
                  onChange={(event) => {
                    setMemberTier(event.target.value);
                    resetPreview();
                  }}
                />
              </div>
              <div>
                <Label htmlFor="member-birth-month">เดือนเกิด (1-12)</Label>
                <Input
                  id="member-birth-month"
                  type="number"
                  min={1}
                  max={12}
                  value={memberBirthMonth}
                  onChange={(event) => {
                    setMemberBirthMonth(event.target.value === "" ? "" : Number(event.target.value));
                    resetPreview();
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <input
                  id="first-time"
                  type="checkbox"
                  checked={isFirstTimeCustomer}
                  onChange={(event) => {
                    setIsFirstTimeCustomer(event.target.checked);
                    resetPreview();
                  }}
                  className="h-4 w-4"
                />
                <Label htmlFor="first-time">ลูกค้าใหม่ครั้งแรก</Label>
              </div>
            </div>
          </details>

          <div className="grid gap-1 rounded-DEFAULT border border-line-strong bg-surface-sunk p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">ยอดรวม</span>
              <span className="font-data tabular-nums text-ink">{formatSatang(subtotalSatang)}</span>
            </div>
            {preview && (
              <div className="flex justify-between">
                <span className="text-ink-muted">ส่วนลด{preview.reason ? ` (${preview.reason})` : ""}</span>
                <span className="font-data tabular-nums text-ink">-{formatSatang(preview.discountSatang)}</span>
              </div>
            )}
            {preview?.couponError && <p className="text-xs text-rose">{preview.couponError}</p>}
            <div className="flex justify-between font-semibold">
              <span>ยอดสุทธิ{preview ? "" : " (ยังไม่คำนวณส่วนลด)"}</span>
              <span className="font-data tabular-nums text-ink">{formatSatang(totalSatang)}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={cartHasEmptyContent || calculateMutation.isPending}
            onClick={() => calculateMutation.mutate()}
          >
            {calculateMutation.isPending ? "กำลังคำนวณ..." : "คำนวณยอด/ส่วนลด"}
          </Button>

          {preview && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">ช่องทางชำระเงิน</h3>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={autofillPayments}>
                    เติมอัตโนมัติ
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={addPaymentRow}>
                    + เพิ่มช่องทาง
                  </Button>
                </div>
              </div>

              {payments.map((p) => (
                <div key={p.key} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <div>
                    <Label htmlFor={`pay-method-${p.key}`} className="text-[10px]">
                      ช่องทาง
                    </Label>
                    <Select
                      id={`pay-method-${p.key}`}
                      value={p.method}
                      onChange={(event) => updatePaymentRow(p.key, { method: event.target.value as PaymentMethod })}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABEL[m]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`pay-amount-${p.key}`} className="text-[10px]">
                      จำนวนเงิน (บาท)
                    </Label>
                    <Input
                      id={`pay-amount-${p.key}`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.amountBaht || ""}
                      onChange={(event) => updatePaymentRow(p.key, { amountBaht: Number(event.target.value) })}
                    />
                  </div>
                  <div>
                    {p.method === "CASH" ? (
                      <>
                        <Label htmlFor={`pay-tendered-${p.key}`} className="text-[10px]">
                          รับเงินมา (บาท)
                        </Label>
                        <Input
                          id={`pay-tendered-${p.key}`}
                          type="number"
                          min={0}
                          step={0.01}
                          value={p.tenderedBaht}
                          onChange={(event) =>
                            updatePaymentRow(p.key, {
                              tenderedBaht: event.target.value === "" ? "" : Number(event.target.value),
                            })
                          }
                        />
                      </>
                    ) : (
                      <div />
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removePaymentRow(p.key)}>
                    ลบ
                  </Button>
                </div>
              ))}

              <div
                className={`rounded-DEFAULT px-3 py-2 text-sm ${
                  paymentsDiffSatang === 0 ? "bg-celadon-tint text-celadon" : "bg-brass-tint text-brass"
                }`}
              >
                {paymentsDiffSatang === 0
                  ? "ยอดชำระตรงกับยอดสุทธิแล้ว"
                  : paymentsDiffSatang > 0
                    ? `ยังขาดอีก ${formatSatang(paymentsDiffSatang)}`
                    : `เกินยอดสุทธิ ${formatSatang(-paymentsDiffSatang)}`}
              </div>
            </div>
          )}

          {checkoutError && (
            <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
              {checkoutError}
            </p>
          )}
          {packageLinesMissingMember && <p className="text-xs text-brass">มีรายการตัดคอร์สแต่ยังไม่ได้เลือกสมาชิก</p>}

          <Button
            type="button"
            disabled={!canCheckout || checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? "กำลังออกบิล..." : "ออกบิล"}
          </Button>
        </section>
      </div>

      {receiptBill && (
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            ออกบิลสำเร็จ — {receiptBill.billNumber}
          </h2>
          <Receipt bill={receiptBill} onClose={() => setReceiptBill(null)} />
        </div>
      )}

      <div className="mt-10 border-t border-line pt-6">
        <BillHistory branchId={branch.branchId} />
      </div>
    </div>
  );
}

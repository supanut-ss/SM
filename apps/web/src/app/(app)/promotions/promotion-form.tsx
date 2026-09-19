"use client";

import { useState, type FormEvent } from "react";
import {
  promotionFormSchema,
  PROMOTION_TYPES,
  PROMOTION_TYPE_LABEL,
  type CreatePromotionInput,
  type PromotionFormInput,
  type PromotionType,
} from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import { ApiError, type Service } from "../../../lib/api-client";
import { EMPTY_PROMOTION_FORM_VALUES, promotionFormToApiInput } from "./promotion-form-schema";

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function minutesToTimeInput(min: number | undefined): string {
  if (min === undefined) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function timeInputToMinutes(value: string): number | undefined {
  if (!value) return undefined;
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * สร้างโปรโมชั่น (T5.4) — 5 ประเภทมีฟิลด์ต่างกันจริง (ดู docs/decisions.md ADR-028) ใช้ state ธรรมดา
 * แทน react-hook-form ด้วยเหตุผลเดียวกับ package-form.tsx (discriminated union ไม่เข้ากับ Path<T>)
 */
export function PromotionForm({
  services,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  services: Service[];
  submitLabel: string;
  onSubmit: (values: CreatePromotionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PromotionFormInput>(EMPTY_PROMOTION_FORM_VALUES.PERCENT_OFF);
  const [showConditions, setShowConditions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function changeType(type: PromotionType) {
    setValues(EMPTY_PROMOTION_FORM_VALUES[type]);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = promotionFormSchema.safeParse(values);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await onSubmit(promotionFormToApiInput(result.data));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleDay(day: number) {
    const current = values.daysOfWeek ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    setValues({ ...values, daysOfWeek: next.length > 0 ? next : undefined });
  }

  const allVariants = services.flatMap((s) => s.variants.map((v) => ({ ...v, serviceName: s.name })));

  return (
    <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="promo-type">ประเภท</Label>
        <Select
          id="promo-type"
          value={values.type}
          onChange={(event) => changeType(event.target.value as PromotionType)}
        >
          {PROMOTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROMOTION_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="promo-name">ชื่อโปรโมชั่น</Label>
        <Input
          id="promo-name"
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          placeholder="เช่น ลด 20% วันธรรมดา"
        />
        {fieldErrors.name && <p className="text-pretty text-xs text-rose">{fieldErrors.name}</p>}
      </div>

      {values.type === "PERCENT_OFF" && (
        <div className="grid gap-1.5">
          <Label htmlFor="promo-percent">ลด (%)</Label>
          <Input
            id="promo-percent"
            type="number"
            min={1}
            max={100}
            step={1}
            value={values.percentOff}
            onChange={(event) => setValues({ ...values, percentOff: Number(event.target.value) })}
          />
          {fieldErrors.percentOff && <p className="text-pretty text-xs text-rose">{fieldErrors.percentOff}</p>}
        </div>
      )}
      {values.type === "AMOUNT_OFF" && (
        <div className="grid gap-1.5">
          <Label htmlFor="promo-amount">ลด (บาท)</Label>
          <Input
            id="promo-amount"
            type="number"
            min={1}
            step={1}
            value={values.amountOffBaht}
            onChange={(event) => setValues({ ...values, amountOffBaht: Number(event.target.value) })}
          />
          {fieldErrors.amountOffBaht && <p className="text-pretty text-xs text-rose">{fieldErrors.amountOffBaht}</p>}
        </div>
      )}
      {values.type === "FIXED_PRICE" && (
        <div className="grid gap-1.5">
          <Label htmlFor="promo-fixed">ราคาพิเศษ (บาท)</Label>
          <Input
            id="promo-fixed"
            type="number"
            min={0}
            step={1}
            value={values.fixedPriceBaht}
            onChange={(event) => setValues({ ...values, fixedPriceBaht: Number(event.target.value) })}
          />
          <p className="text-pretty text-xs text-ink-muted">ใช้ได้กับรายการเดียวในตะกร้าเท่านั้น</p>
          {fieldErrors.fixedPriceBaht && <p className="text-pretty text-xs text-rose">{fieldErrors.fixedPriceBaht}</p>}
        </div>
      )}
      {values.type === "BUY_X_GET_Y" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="promo-buy">ซื้อ (ชิ้น)</Label>
            <Input
              id="promo-buy"
              type="number"
              min={1}
              step={1}
              value={values.buyQuantity}
              onChange={(event) => setValues({ ...values, buyQuantity: Number(event.target.value) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="promo-get">แถม (ชิ้น)</Label>
            <Input
              id="promo-get"
              type="number"
              min={1}
              step={1}
              value={values.getQuantity}
              onChange={(event) => setValues({ ...values, getQuantity: Number(event.target.value) })}
            />
          </div>
        </div>
      )}
      {values.type === "BONUS_MINUTES" && (
        <div className="grid gap-1.5">
          <Label htmlFor="promo-bonus">แถมเวลา (นาที)</Label>
          <Input
            id="promo-bonus"
            type="number"
            min={1}
            step={1}
            value={values.bonusMinutes}
            onChange={(event) => setValues({ ...values, bonusMinutes: Number(event.target.value) })}
          />
          <p className="text-pretty text-xs text-ink-muted">ไม่ใช่ส่วนลดเป็นเงิน — มักแพ้โปรฯ อื่นที่ลดเป็นเงินถ้าเข้าเงื่อนไขพร้อมกัน</p>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="promo-quota">โควตา (ไม่บังคับ — เว้นว่าง = ไม่จำกัด)</Label>
        <Input
          id="promo-quota"
          type="number"
          min={1}
          step={1}
          value={values.quotaTotal ?? ""}
          onChange={(event) =>
            setValues({ ...values, quotaTotal: event.target.value ? Number(event.target.value) : undefined })
          }
        />
      </div>

      <div className="border-t border-line pt-4">
        <button
          type="button"
          className="text-sm font-medium text-ink underline-offset-2 hover:underline"
          onClick={() => setShowConditions((v) => !v)}
        >
          {showConditions ? "ซ่อนเงื่อนไขเพิ่มเติม" : "+ เงื่อนไขเพิ่มเติม (ไม่บังคับ)"}
        </button>

        {showConditions && (
          <div className="mt-3 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="promo-min-spend">ยอดขั้นต่ำของบิล (บาท)</Label>
              <Input
                id="promo-min-spend"
                type="number"
                min={0}
                step={1}
                value={values.minSpendBaht ?? ""}
                onChange={(event) =>
                  setValues({
                    ...values,
                    minSpendBaht: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label>จำกัดเฉพาะบริการ (ไม่เลือก = ทุกบริการ)</Label>
              <div className="grid max-h-32 gap-1 overflow-y-auto rounded-DEFAULT border border-line p-2">
                {allVariants.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={(values.serviceVariantIds ?? []).includes(v.id)}
                      onChange={(event) => {
                        const current = values.serviceVariantIds ?? [];
                        const next = event.target.checked
                          ? [...current, v.id]
                          : current.filter((id) => id !== v.id);
                        setValues({ ...values, serviceVariantIds: next.length > 0 ? next : undefined });
                      }}
                    />
                    {v.serviceName} · {v.durationMin} นาที
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>วันที่ใช้ได้ (ไม่เลือก = ทุกวัน)</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={
                      (values.daysOfWeek ?? []).includes(day)
                        ? "rounded-DEFAULT bg-celadon px-2.5 py-1 text-xs font-medium text-white"
                        : "rounded-DEFAULT border border-line-strong px-2.5 py-1 text-xs text-ink-muted"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="promo-start-time">เวลาเริ่ม (ไม่บังคับ)</Label>
                <Input
                  id="promo-start-time"
                  type="time"
                  value={minutesToTimeInput(values.startMinuteOfDay)}
                  onChange={(event) =>
                    setValues({ ...values, startMinuteOfDay: timeInputToMinutes(event.target.value) })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="promo-end-time">เวลาสิ้นสุด (ไม่บังคับ)</Label>
                <Input
                  id="promo-end-time"
                  type="time"
                  value={minutesToTimeInput(values.endMinuteOfDay)}
                  onChange={(event) =>
                    setValues({ ...values, endMinuteOfDay: timeInputToMinutes(event.target.value) })
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.firstTimeCustomerOnly ?? false}
                onChange={(event) => setValues({ ...values, firstTimeCustomerOnly: event.target.checked })}
              />
              เฉพาะลูกค้าใหม่ครั้งแรกเท่านั้น
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.birthdayMonthOnly ?? false}
                onChange={(event) => setValues({ ...values, birthdayMonthOnly: event.target.checked })}
              />
              เฉพาะเดือนเกิดของสมาชิกเท่านั้น
            </label>

            <div className="grid gap-1.5">
              <Label htmlFor="promo-tiers">ระดับสมาชิกที่ใช้ได้ (คั่นด้วยจุลภาค, ไม่กรอก = ทุกระดับ)</Label>
              <Input
                id="promo-tiers"
                value={(values.memberTiers ?? []).join(", ")}
                onChange={(event) =>
                  setValues({
                    ...values,
                    memberTiers: event.target.value
                      ? event.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                      : undefined,
                  })
                }
                placeholder="เช่น GOLD, SILVER"
              />
            </div>
          </div>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "กำลังบันทึก..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

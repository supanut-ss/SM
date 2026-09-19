"use client";

import { useState, type FormEvent } from "react";
import {
  packageFormSchema,
  PACKAGE_TYPES,
  PACKAGE_TYPE_LABEL,
  type CreatePackageInput,
  type PackageFormInput,
  type PackageType,
} from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import { ApiError, type Package } from "../../../lib/api-client";
import { EMPTY_PACKAGE_FORM_VALUES, packageFormToApiInput } from "./package-form-schema";

type ServiceVariantOption = NonNullable<Package["serviceVariant"]>;

/**
 * สร้างคอร์ส/แพ็กเกจ — 3 ประเภทมีฟิลด์ต่างกันจริง (ดู docs/decisions.md ADR-025) ใช้ state ธรรมดา
 * แทน react-hook-form เพราะ packageFormSchema เป็น discriminated union — react-hook-form ผูก type
 * ของ register()/Path<T> กับ object เดียว ไม่รองรับ union ที่ฟิลด์เปลี่ยนชุดตาม type ได้ตรงไปตรงมา
 */
export function PackageForm({
  serviceVariants,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  serviceVariants: ServiceVariantOption[];
  submitLabel: string;
  onSubmit: (values: CreatePackageInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PackageFormInput>(EMPTY_PACKAGE_FORM_VALUES.SESSION_COUNT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function changeType(type: PackageType) {
    setValues(EMPTY_PACKAGE_FORM_VALUES[type]);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = packageFormSchema.safeParse(values);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await onSubmit(packageFormToApiInput(result.data));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsServiceVariant = values.type === "SESSION_COUNT" || values.type === "UNLIMITED_DURATION";

  return (
    <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="package-type">ประเภท</Label>
        <Select
          id="package-type"
          value={values.type}
          onChange={(event) => changeType(event.target.value as PackageType)}
        >
          {PACKAGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {PACKAGE_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="package-name">ชื่อคอร์ส/แพ็กเกจ</Label>
        <Input
          id="package-name"
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          placeholder="เช่น คอร์สนวดไทย 10 ครั้ง"
        />
        {fieldErrors.name && <p className="text-pretty text-xs text-rose">{fieldErrors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="package-price">ราคา (บาท)</Label>
          <Input
            id="package-price"
            type="number"
            min={0}
            step={1}
            value={values.priceBaht}
            onChange={(event) => setValues({ ...values, priceBaht: Number(event.target.value) })}
          />
          {fieldErrors.priceBaht && <p className="text-pretty text-xs text-rose">{fieldErrors.priceBaht}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="package-valid-days">อายุการใช้งาน (วัน)</Label>
          <Input
            id="package-valid-days"
            type="number"
            min={1}
            step={1}
            value={values.validDays}
            onChange={(event) => setValues({ ...values, validDays: Number(event.target.value) })}
          />
          {fieldErrors.validDays && <p className="text-pretty text-xs text-rose">{fieldErrors.validDays}</p>}
        </div>
      </div>

      {values.type === "VALUE" && (
        <div className="grid gap-1.5">
          <Label htmlFor="package-value">มูลค่าคอร์ส (บาท)</Label>
          <Input
            id="package-value"
            type="number"
            min={0.01}
            step={1}
            value={values.valueBaht}
            onChange={(event) => setValues({ ...values, valueBaht: Number(event.target.value) })}
          />
          <p className="text-pretty text-xs text-ink-muted">ใช้ตัดยอดข้ามบริการได้ ไม่ผูกกับบริการใดบริการหนึ่ง</p>
          {fieldErrors.valueBaht && <p className="text-pretty text-xs text-rose">{fieldErrors.valueBaht}</p>}
        </div>
      )}

      {needsServiceVariant && (
        <div className="grid gap-1.5">
          <Label htmlFor="package-service-variant">บริการที่ผูกไว้</Label>
          {serviceVariants.length === 0 ? (
            <p className="text-pretty text-xs text-brass">สาขานี้ยังไม่มีบริการเลย — เพิ่มบริการก่อนสร้างคอร์สประเภทนี้</p>
          ) : (
            <Select
              id="package-service-variant"
              value={"serviceVariantId" in values ? values.serviceVariantId : ""}
              onChange={(event) => setValues({ ...values, serviceVariantId: event.target.value })}
            >
              <option value="" disabled>
                -- เลือกบริการ --
              </option>
              {serviceVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.service.name} · {v.durationMin} นาที
                </option>
              ))}
            </Select>
          )}
          {fieldErrors.serviceVariantId && <p className="text-pretty text-xs text-rose">{fieldErrors.serviceVariantId}</p>}
        </div>
      )}

      {values.type === "SESSION_COUNT" && (
        <div className="grid gap-1.5">
          <Label htmlFor="package-session-count">จำนวนครั้ง</Label>
          <Input
            id="package-session-count"
            type="number"
            min={1}
            step={1}
            value={values.sessionCount}
            onChange={(event) => setValues({ ...values, sessionCount: Number(event.target.value) })}
          />
          {fieldErrors.sessionCount && <p className="text-pretty text-xs text-rose">{fieldErrors.sessionCount}</p>}
        </div>
      )}

      {formError && (
        <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {formError}
        </p>
      )}

      <div className="sticky -bottom-5 -mx-6 -mb-5 flex justify-end gap-3 border-t border-line bg-surface px-6 pb-5 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isSubmitting || (needsServiceVariant && serviceVariants.length === 0)}>
          {isSubmitting ? "กำลังบันทึก..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

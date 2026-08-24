"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  packageEditFormSchema,
  type PackageEditFormFormInput,
  type PackageEditFormInput,
  type UpdatePackageInput,
} from "@lotus-desk/contracts";
import { Button, Input, Label } from "@lotus-desk/ui";
import { ApiError } from "../../../lib/api-client";

/**
 * แก้ไขคอร์ส/แพ็กเกจ — เฉพาะ name/priceSatang/validDays เท่านั้น (isActive สลับผ่านปุ่มในตารางรายการ
 * เหมือน ServicePageClient) ห้ามแก้ type/sessionCount/valueSatang/serviceVariantId หลังสร้างแล้ว
 * (ดู docs/decisions.md ADR-025)
 */
export function PackageEditForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues: PackageEditFormFormInput;
  onSubmit: (values: UpdatePackageInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PackageEditFormFormInput, unknown, PackageEditFormInput>({
    resolver: zodResolver(packageEditFormSchema),
    defaultValues: initialValues,
  });

  async function submit(values: PackageEditFormInput) {
    setFormError(null);
    try {
      await onSubmit({
        name: values.name,
        priceSatang: Math.round(values.priceBaht * 100),
        validDays: values.validDays,
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-package-name">ชื่อคอร์ส/แพ็กเกจ</Label>
        <Input id="edit-package-name" {...register("name")} />
        {errors.name && <p className="text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="edit-package-price">ราคา (บาท)</Label>
          <Input id="edit-package-price" type="number" min={0} step={1} {...register("priceBaht")} />
          {errors.priceBaht && <p className="text-xs text-rose">{errors.priceBaht.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-package-valid-days">อายุการใช้งาน (วัน)</Label>
          <Input id="edit-package-valid-days" type="number" min={1} step={1} {...register("validDays")} />
          {errors.validDays && <p className="text-xs text-rose">{errors.validDays.message}</p>}
        </div>
      </div>

      {formError && (
        <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </Button>
      </div>
    </form>
  );
}

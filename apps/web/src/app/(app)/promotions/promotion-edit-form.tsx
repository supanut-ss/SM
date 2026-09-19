"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { UpdatePromotionInput } from "@lotus-desk/contracts";
import { Button, Input, Label } from "@lotus-desk/ui";
import { ApiError } from "../../../lib/api-client";

interface EditFormValues {
  name: string;
  priority: number;
  quotaTotal: number | "";
}

/**
 * แก้ไขโปรโมชั่น — เฉพาะ name/priority/quotaTotal/isActive (isActive สลับผ่านปุ่มในตารางรายการเหมือน
 * PackagePageClient) ห้ามแก้ type/ฟิลด์ส่วนลดเฉพาะประเภทหลังสร้างแล้ว (ดู docs/decisions.md ADR-028)
 * ยังไม่รองรับแก้ไขเงื่อนไข (conditions) ในฟอร์มนี้ — ต้องลบแล้วสร้างใหม่ถ้าต้องการเปลี่ยนเงื่อนไข
 * (ขอบเขตจำกัดไว้ให้ฟอร์มไม่ใหญ่เกินไป เก็บเป็นข้อควรระวังสำหรับอนาคตใน ADR-028)
 */
export function PromotionEditForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues: EditFormValues;
  onSubmit: (values: UpdatePromotionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({ defaultValues: initialValues });

  async function submit(values: EditFormValues) {
    setFormError(null);
    try {
      await onSubmit({
        name: values.name,
        priority: Number(values.priority),
        quotaTotal: values.quotaTotal === "" ? null : Number(values.quotaTotal),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-promo-name">ชื่อโปรโมชั่น</Label>
        <Input id="edit-promo-name" {...register("name", { required: "กรุณากรอกชื่อโปรโมชั่น" })} />
        {errors.name && <p className="text-pretty text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="edit-promo-priority">ลำดับความสำคัญ</Label>
          <Input id="edit-promo-priority" type="number" step={1} {...register("priority")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-promo-quota">โควตา (เว้นว่าง = ไม่จำกัด)</Label>
          <Input id="edit-promo-quota" type="number" min={1} step={1} {...register("quotaTotal")} />
        </div>
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
          {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </Button>
      </div>
    </form>
  );
}

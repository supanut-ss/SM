"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateServiceSchema, type UpdateServiceFormInput, type UpdateServiceInput } from "@lotus-desk/contracts";
import { Button, Input, Label, Select, Textarea } from "@lotus-desk/ui";
import { ApiError, type ServiceCategory } from "../../../lib/api-client";

/** แก้ไขข้อมูลบริการระดับบนเท่านั้น (ไม่รวมตัวเลือกเวลา — จัดการแยกใน service-page-client.tsx) */
export function ServiceEditForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: {
  categories: ServiceCategory[];
  initialValues: UpdateServiceFormInput;
  onSubmit: (values: UpdateServiceInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateServiceFormInput, unknown, UpdateServiceInput>({
    resolver: zodResolver(updateServiceSchema),
    defaultValues: initialValues,
  });

  async function submit(values: UpdateServiceInput) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-service-category">หมวดบริการ</Label>
        <Select id="edit-service-category" {...register("categoryId")}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {errors.categoryId && <p className="text-pretty text-xs text-rose">{errors.categoryId.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="edit-service-name">ชื่อบริการ</Label>
        <Input id="edit-service-name" {...register("name")} />
        {errors.name && <p className="text-pretty text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="edit-service-description">คำอธิบาย (ไม่บังคับ)</Label>
        <Textarea id="edit-service-description" {...register("description")} rows={2} />
        {errors.description && <p className="text-pretty text-xs text-rose">{errors.description.message}</p>}
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

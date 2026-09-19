"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { createShiftTemplateSchema, type CreateShiftTemplateInput } from "@lotus-desk/contracts";
import { Button, Input, Label } from "@lotus-desk/ui";
import { ApiError } from "../../../../lib/api-client";
import { minToTimeString, timeStringToMin } from "./time-format";

export interface ShiftTemplateFormValues {
  name: string;
  startTime: string;
  endTime: string;
}

export function shiftTemplateValuesToApiInput(values: ShiftTemplateFormValues): CreateShiftTemplateInput {
  return {
    name: values.name,
    startMin: timeStringToMin(values.startTime),
    endMin: timeStringToMin(values.endTime),
  };
}

export function shiftTemplateDefaults(startMin: number, endMin: number, name = ""): ShiftTemplateFormValues {
  return { name, startTime: minToTimeString(startMin), endTime: minToTimeString(endMin) };
}

const formSchema = createShiftTemplateSchema;

export function ShiftTemplateForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues: ShiftTemplateFormValues;
  submitLabel: string;
  onSubmit: (input: CreateShiftTemplateInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShiftTemplateFormValues>({
    defaultValues: initialValues,
  });

  async function submit(values: ShiftTemplateFormValues) {
    setFormError(null);
    const input = shiftTemplateValuesToApiInput(values);
    const parsed = formSchema.safeParse(input);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="shift-template-name">ชื่อกะ</Label>
        <Input
          id="shift-template-name"
          {...register("name", { required: "กรุณากรอกชื่อกะ" })}
          placeholder="เช่น เช้า"
        />
        {errors.name && <p className="text-pretty text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="shift-template-start">เวลาเริ่ม</Label>
          <Input id="shift-template-start" type="time" {...register("startTime", { required: true })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="shift-template-end">เวลาสิ้นสุด</Label>
          <Input id="shift-template-end" type="time" {...register("endTime", { required: true })} />
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
          {isSubmitting ? "กำลังบันทึก..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

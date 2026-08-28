"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createStaffSchema,
  STAFF_LEVELS,
  STAFF_LEVEL_LABEL,
  STAFF_SKILLS,
  STAFF_SKILL_LABEL,
  type CreateStaffFormInput,
  type CreateStaffInput,
} from "@lotus-desk/contracts";
import { Button, Input, Label, Select, Textarea } from "@lotus-desk/ui";
import { ApiError } from "../../../lib/api-client";

export type StaffFormValues = CreateStaffInput;

// สร้าง/แก้ พนักงานใช้ schema เดียวกัน (createStaffSchema) — ตัวฟอร์มเองต้อง type เป็น "input" ของ
// schema (ก่อนผ่าน resolver) ไม่ใช่ "output" เพราะ phone/startDate/note ใช้ z.preprocess ที่รับ
// unknown เป็น input เสมอ ส่วน onSubmit ยังรับ output ที่ validate แล้ว (StaffFormValues) ตามปกติ
// ผ่าน generic ตัวที่ 3 ของ useForm (ดู react-hook-form + @hookform/resolvers "TTransformedValues")
const EMPTY_VALUES: Partial<CreateStaffFormInput> = {
  name: "",
  phone: "",
  skills: [],
  note: "",
};

export function StaffForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: Partial<StaffFormValues>;
  submitLabel: string;
  onSubmit: (values: StaffFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffFormInput, unknown, StaffFormValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { ...EMPTY_VALUES, ...initialValues },
  });

  async function submit(values: StaffFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="staff-name">ชื่อพนักงาน</Label>
        <Input id="staff-name" {...register("name")} placeholder="เช่น คุณสมชาย ใจดี" />
        {errors.name && (
          <p className="text-xs text-rose">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="staff-phone">เบอร์โทร (ถ้ามี)</Label>
        <Input id="staff-phone" {...register("phone")} placeholder="0812345678" inputMode="numeric" />
        {errors.phone && <p className="text-xs text-rose">{errors.phone.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="staff-level">ระดับ</Label>
        <Select id="staff-level" {...register("level")} defaultValue="">
          <option value="" disabled>
            -- เลือกระดับ --
          </option>
          {STAFF_LEVELS.map((level) => (
            <option key={level} value={level}>
              {STAFF_LEVEL_LABEL[level]}
            </option>
          ))}
        </Select>
        {errors.level && <p className="text-xs text-rose">{errors.level.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label id="staff-skills-label">ทักษะ</Label>
        <Controller
          name="skills"
          control={control}
          render={({ field }) => (
            <div role="group" aria-labelledby="staff-skills-label" className="grid grid-cols-2 gap-2">
              {STAFF_SKILLS.map((skill) => {
                const checked = field.value?.includes(skill) ?? false;
                return (
                  <label
                    key={skill}
                    className="flex items-center gap-2 rounded-DEFAULT border border-line-strong px-3 py-2 text-sm text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-celadon"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...(field.value ?? []), skill]
                          : (field.value ?? []).filter((s) => s !== skill);
                        field.onChange(next);
                      }}
                      className="h-4 w-4 accent-celadon"
                    />
                    {STAFF_SKILL_LABEL[skill]}
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.skills && <p className="text-xs text-rose">{errors.skills.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="staff-start-date">วันเริ่มงาน (ถ้ามี)</Label>
        <Controller
          name="startDate"
          control={control}
          render={({ field }) => (
            <Input
              id="staff-start-date"
              type="date"
              // date-only string <-> Date ต้อง parse/format แบบ UTC เสมอ (ไม่ใช้ local timezone
              // constructor) ไม่งั้นวันที่จะเลื่อนไป 1 วันตามเขตเวลาเครื่อง (ดู CLAUDE.md ข้อ 3)
              value={field.value ? (field.value as Date).toISOString().slice(0, 10) : ""}
              onChange={(event) =>
                field.onChange(event.target.value ? new Date(event.target.value) : undefined)
              }
            />
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="staff-note">บันทึกเพิ่มเติม (ถ้ามี)</Label>
        <Textarea id="staff-note" rows={3} {...register("note")} />
        {errors.note && <p className="text-xs text-rose">{errors.note.message}</p>}
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
          {isSubmitting ? "กำลังบันทึก..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

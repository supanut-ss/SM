"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createMemberSchema, type CreateMemberFormInput, type CreateMemberInput } from "@lotus-desk/contracts";
import { Button, Input, Label, Textarea } from "@lotus-desk/ui";
import { ApiError, type MemberDuplicatePhoneConflict } from "../../../lib/api-client";

export type MemberFormValues = CreateMemberInput;

const EMPTY_VALUES: Partial<CreateMemberFormInput> = {
  name: "",
  phone: "",
  note: "",
};

export function MemberForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: Partial<MemberFormValues>;
  submitLabel: string;
  onSubmit: (values: MemberFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<MemberDuplicatePhoneConflict | null>(null);
  const [lastValues, setLastValues] = useState<MemberFormValues | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMemberFormInput, unknown, MemberFormValues>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: { ...EMPTY_VALUES, ...initialValues },
  });

  async function submit(values: MemberFormValues) {
    setFormError(null);
    setDuplicateConflict(null);
    setLastValues(values);
    try {
      await onSubmit(values);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.body &&
        typeof err.body === "object" &&
        "duplicates" in err.body
      ) {
        setDuplicateConflict(err.body as MemberDuplicatePhoneConflict);
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  async function confirmCreateDuplicate() {
    if (!lastValues) return;
    setFormError(null);
    try {
      await onSubmit({ ...lastValues, confirmDuplicate: true });
      setDuplicateConflict(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="member-name">ชื่อสมาชิก</Label>
        <Input id="member-name" {...register("name")} placeholder="เช่น สมหญิง ใจดี" />
        {errors.name && <p className="text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="member-phone">เบอร์โทร</Label>
        <Input id="member-phone" {...register("phone")} placeholder="0812345678" />
        {errors.phone && <p className="text-xs text-rose">{errors.phone.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="member-note">บันทึก (ไม่บังคับ)</Label>
        <Textarea id="member-note" {...register("note")} rows={2} />
        {errors.note && <p className="text-xs text-rose">{errors.note.message}</p>}
      </div>

      {duplicateConflict && (
        <div className="rounded-DEFAULT bg-brass-tint px-3 py-2.5 text-sm text-brass">
          <p className="mb-2">{duplicateConflict.message}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => void confirmCreateDuplicate()}
          >
            ยืนยันสร้างสมาชิกนี้ต่อไป
          </Button>
        </div>
      )}

      {formError && (
        <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {formError}
        </p>
      )}

      <div className="sticky -bottom-5 -mx-6 -mb-5 flex justify-end gap-3 border-t border-line bg-surface px-6 pb-5 pt-4">
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

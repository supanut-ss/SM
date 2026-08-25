"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { LEAVE_TYPES, LEAVE_TYPE_LABEL, type CreateStaffLeaveInput } from "@lotus-desk/contracts";
import { Button, Input, Label, Select, Textarea } from "@lotus-desk/ui";
import { ApiError, type StaffProfile } from "../../../../lib/api-client";
import { toDateKey } from "./time-format";

export interface StaffLeaveFormValues {
  staffId: string;
  type: (typeof LEAVE_TYPES)[number];
  dateFrom: string;
  dateTo: string;
  note: string;
}

export function StaffLeaveForm({
  staff,
  initialValues,
  onSubmit,
  onCancel,
}: {
  staff: StaffProfile[];
  initialValues: StaffLeaveFormValues;
  onSubmit: (input: CreateStaffLeaveInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLeaveFormValues>({ defaultValues: initialValues });

  async function submit(values: StaffLeaveFormValues) {
    setFormError(null);
    try {
      await onSubmit({
        staffId: values.staffId,
        type: values.type,
        dateFrom: new Date(values.dateFrom),
        dateTo: new Date(values.dateTo),
        note: values.note,
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="leave-staff">พนักงาน</Label>
        <Select id="leave-staff" {...register("staffId", { required: "กรุณาเลือกพนักงาน" })}>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {errors.staffId && <p className="text-xs text-rose">{errors.staffId.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="leave-type">ประเภทการลา</Label>
        <Select id="leave-type" {...register("type", { required: true })}>
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {LEAVE_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="leave-from">ตั้งแต่วันที่</Label>
          <Input id="leave-from" type="date" {...register("dateFrom", { required: true })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="leave-to">ถึงวันที่</Label>
          <Input id="leave-to" type="date" {...register("dateTo", { required: true })} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="leave-note">หมายเหตุ (ไม่บังคับ)</Label>
        <Textarea id="leave-note" {...register("note")} rows={2} />
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
        <Button type="submit" disabled={isSubmitting || staff.length === 0}>
          {isSubmitting ? "กำลังบันทึก..." : "บันทึกวันลา"}
        </Button>
      </div>
    </form>
  );
}

export function defaultStaffLeaveValues(staffId: string, date: Date): StaffLeaveFormValues {
  const key = toDateKey(date);
  return { staffId, type: "SICK", dateFrom: key, dateTo: key, note: "" };
}

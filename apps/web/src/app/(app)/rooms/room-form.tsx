"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRoomSchema, type CreateRoomFormInput, type CreateRoomInput } from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import { ApiError, type RoomType } from "../../../lib/api-client";

export type RoomFormValues = CreateRoomInput;

const EMPTY_VALUES: Partial<CreateRoomFormInput> = {
  name: "",
  roomTypeId: "",
  capacity: 1,
};

export function RoomForm({
  roomTypes,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  roomTypes: RoomType[];
  initialValues?: Partial<RoomFormValues>;
  submitLabel: string;
  onSubmit: (values: RoomFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomFormInput, unknown, RoomFormValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { ...EMPTY_VALUES, ...initialValues },
  });

  async function submit(values: RoomFormValues) {
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
        <Label htmlFor="room-name">ชื่อห้อง</Label>
        <Input id="room-name" {...register("name")} placeholder="เช่น ห้อง 1" />
        {errors.name && <p className="text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="room-type">ประเภทห้อง</Label>
        {roomTypes.length === 0 ? (
          <p className="text-xs text-brass">
            สาขานี้ยังไม่มีประเภทห้องเลย — ติดต่อผู้ดูแลระบบเพื่อเพิ่มประเภทห้องก่อน
          </p>
        ) : (
          <Select id="room-type" {...register("roomTypeId")} defaultValue="">
            <option value="" disabled>
              -- เลือกประเภทห้อง --
            </option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </Select>
        )}
        {errors.roomTypeId && <p className="text-xs text-rose">{errors.roomTypeId.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="room-capacity">ความจุ (จำนวนลูกค้าพร้อมกัน)</Label>
        <Input id="room-capacity" type="number" min={1} step={1} {...register("capacity")} />
        {errors.capacity && <p className="text-xs text-rose">{errors.capacity.message}</p>}
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
        <Button type="submit" disabled={isSubmitting || roomTypes.length === 0}>
          {isSubmitting ? "กำลังบันทึก..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  STAFF_SKILLS,
  STAFF_SKILL_LABEL,
  variantFormSchema,
  type CreateServiceVariantInput,
  type VariantFormFormInput,
  type VariantFormInput,
} from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import { ApiError, type RoomType } from "../../../lib/api-client";
import { variantFormToApiInput } from "./variant-form-schema";

/** ใช้ทั้งเพิ่มตัวเลือกเวลาใหม่และแก้ไขตัวเลือกเวลาเดิม 1 รายการ (ดู ServiceController.addVariant/updateVariant) */
export function ServiceVariantForm({
  roomTypes,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  roomTypes: RoomType[];
  initialValues: VariantFormFormInput;
  submitLabel: string;
  onSubmit: (input: CreateServiceVariantInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormFormInput, unknown, VariantFormInput>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: initialValues,
  });

  async function submit(values: VariantFormInput) {
    setFormError(null);
    try {
      await onSubmit(variantFormToApiInput(values));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="variant-duration">ระยะเวลา (นาที)</Label>
          <Input id="variant-duration" type="number" min={1} step={1} {...register("durationMin")} />
          {errors.durationMin && <p className="text-xs text-rose">{errors.durationMin.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variant-price">ราคา (บาท)</Label>
          <Input id="variant-price" type="number" min={0} step={1} {...register("priceBaht")} />
          {errors.priceBaht && <p className="text-xs text-rose">{errors.priceBaht.message}</p>}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>ค่ามือ (บาท ต่อครั้ง แยกตามระดับพนักงาน)</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1">
            <Label htmlFor="variant-commission-junior" className="text-xs font-normal text-ink-muted">
              จูเนียร์
            </Label>
            <Input
              id="variant-commission-junior"
              type="number"
              min={0}
              step={1}
              {...register("commissionJuniorBaht")}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="variant-commission-senior" className="text-xs font-normal text-ink-muted">
              ซีเนียร์
            </Label>
            <Input
              id="variant-commission-senior"
              type="number"
              min={0}
              step={1}
              {...register("commissionSeniorBaht")}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="variant-commission-master" className="text-xs font-normal text-ink-muted">
              มาสเตอร์
            </Label>
            <Input
              id="variant-commission-master"
              type="number"
              min={0}
              step={1}
              {...register("commissionMasterBaht")}
            />
          </div>
        </div>
        {(errors.commissionJuniorBaht || errors.commissionSeniorBaht || errors.commissionMasterBaht) && (
          <p className="text-xs text-rose">
            {errors.commissionJuniorBaht?.message ??
              errors.commissionSeniorBaht?.message ??
              errors.commissionMasterBaht?.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="variant-buffer-before">buffer ก่อนบริการ (นาที)</Label>
          <Input
            id="variant-buffer-before"
            type="number"
            min={0}
            step={1}
            {...register("bufferBeforeMin")}
          />
          {errors.bufferBeforeMin && <p className="text-xs text-rose">{errors.bufferBeforeMin.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variant-buffer-after">buffer หลังบริการ (นาที)</Label>
          <Input
            id="variant-buffer-after"
            type="number"
            min={0}
            step={1}
            {...register("bufferAfterMin")}
          />
          {errors.bufferAfterMin && <p className="text-xs text-rose">{errors.bufferAfterMin.message}</p>}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="variant-skill">ทักษะที่ต้องใช้</Label>
        <Select id="variant-skill" {...register("requiredSkill")}>
          {STAFF_SKILLS.map((skill) => (
            <option key={skill} value={skill}>
              {STAFF_SKILL_LABEL[skill]}
            </option>
          ))}
        </Select>
        {errors.requiredSkill && <p className="text-xs text-rose">{errors.requiredSkill.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="variant-room-type">ประเภทห้องที่ต้องใช้</Label>
        {roomTypes.length === 0 ? (
          <p className="text-xs text-brass">สาขานี้ยังไม่มีประเภทห้องเลย — ติดต่อผู้ดูแลระบบก่อน</p>
        ) : (
          <Select id="variant-room-type" {...register("requiredRoomTypeId")} defaultValue="">
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
        {errors.requiredRoomTypeId && (
          <p className="text-xs text-rose">{errors.requiredRoomTypeId.message}</p>
        )}
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

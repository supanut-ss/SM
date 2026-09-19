"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  serviceFormSchema,
  STAFF_SKILLS,
  STAFF_SKILL_LABEL,
  type CreateServiceInput,
  type ServiceFormFormInput,
  type ServiceFormInput,
} from "@lotus-desk/contracts";
import { Button, Input, Label, Select, Textarea } from "@lotus-desk/ui";
import { ApiError, type RoomType, type ServiceCategory } from "../../../lib/api-client";
import { EMPTY_VARIANT_FORM_VALUES, variantFormToApiInput } from "./variant-form-schema";

const EMPTY_VALUES: ServiceFormFormInput = {
  categoryId: "",
  name: "",
  description: "",
  variants: [EMPTY_VARIANT_FORM_VALUES],
};

export function ServiceForm({
  categories,
  roomTypes,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  categories: ServiceCategory[];
  roomTypes: RoomType[];
  submitLabel: string;
  onSubmit: (values: CreateServiceInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormFormInput, unknown, ServiceFormInput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  async function submit(values: ServiceFormInput) {
    setFormError(null);
    try {
      await onSubmit({
        categoryId: values.categoryId,
        name: values.name,
        description: values.description,
        variants: values.variants.map((v) => variantFormToApiInput(v)),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  const variantsRootError = (errors.variants as { message?: string } | undefined)?.message;

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="service-category">หมวดบริการ</Label>
        {categories.length === 0 ? (
          <p className="text-pretty text-xs text-brass">
            สาขานี้ยังไม่มีหมวดบริการเลย — ติดต่อผู้ดูแลระบบเพื่อเพิ่มหมวดบริการก่อน
          </p>
        ) : (
          <Select id="service-category" {...register("categoryId")} defaultValue="">
            <option value="" disabled>
              -- เลือกหมวดบริการ --
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {errors.categoryId && <p className="text-pretty text-xs text-rose">{errors.categoryId.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="service-name">ชื่อบริการ</Label>
        <Input id="service-name" {...register("name")} placeholder="เช่น นวดไทย" />
        {errors.name && <p className="text-pretty text-xs text-rose">{errors.name.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="service-description">คำอธิบาย (ไม่บังคับ)</Label>
        <Textarea id="service-description" {...register("description")} rows={2} />
        {errors.description && <p className="text-pretty text-xs text-rose">{errors.description.message}</p>}
      </div>

      <div className="grid gap-3 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-ink">ตัวเลือกเวลา</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => append(EMPTY_VARIANT_FORM_VALUES)}
          >
            + เพิ่มตัวเลือกเวลา
          </Button>
        </div>
        {variantsRootError && <p className="text-pretty text-xs text-rose">{variantsRootError}</p>}

        {fields.map((field, index) => {
          const variantErrors = errors.variants?.[index];
          return (
            <div key={field.id} className="grid gap-3 rounded-DEFAULT border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">ตัวเลือกที่ {index + 1}</span>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose hover:bg-rose-tint"
                    onClick={() => remove(index)}
                  >
                    ลบ
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor={`variant-${index}-duration`}>ระยะเวลา (นาที)</Label>
                  <Input
                    id={`variant-${index}-duration`}
                    type="number"
                    min={1}
                    step={1}
                    {...register(`variants.${index}.durationMin`)}
                  />
                  {variantErrors?.durationMin && (
                    <p className="text-pretty text-xs text-rose">{variantErrors.durationMin.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`variant-${index}-price`}>ราคา (บาท)</Label>
                  <Input
                    id={`variant-${index}-price`}
                    type="number"
                    min={0}
                    step={1}
                    {...register(`variants.${index}.priceBaht`)}
                  />
                  {variantErrors?.priceBaht && (
                    <p className="text-pretty text-xs text-rose">{variantErrors.priceBaht.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>ค่ามือ (บาท ต่อครั้ง แยกตามระดับพนักงาน)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <Label
                      htmlFor={`variant-${index}-commission-junior`}
                      className="text-xs font-normal text-ink-muted"
                    >
                      จูเนียร์
                    </Label>
                    <Input
                      id={`variant-${index}-commission-junior`}
                      type="number"
                      min={0}
                      step={1}
                      {...register(`variants.${index}.commissionJuniorBaht`)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label
                      htmlFor={`variant-${index}-commission-senior`}
                      className="text-xs font-normal text-ink-muted"
                    >
                      ซีเนียร์
                    </Label>
                    <Input
                      id={`variant-${index}-commission-senior`}
                      type="number"
                      min={0}
                      step={1}
                      {...register(`variants.${index}.commissionSeniorBaht`)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label
                      htmlFor={`variant-${index}-commission-master`}
                      className="text-xs font-normal text-ink-muted"
                    >
                      มาสเตอร์
                    </Label>
                    <Input
                      id={`variant-${index}-commission-master`}
                      type="number"
                      min={0}
                      step={1}
                      {...register(`variants.${index}.commissionMasterBaht`)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor={`variant-${index}-buffer-before`}>buffer ก่อนบริการ (นาที)</Label>
                  <Input
                    id={`variant-${index}-buffer-before`}
                    type="number"
                    min={0}
                    step={1}
                    {...register(`variants.${index}.bufferBeforeMin`)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`variant-${index}-buffer-after`}>buffer หลังบริการ (นาที)</Label>
                  <Input
                    id={`variant-${index}-buffer-after`}
                    type="number"
                    min={0}
                    step={1}
                    {...register(`variants.${index}.bufferAfterMin`)}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`variant-${index}-skill`}>ทักษะที่ต้องใช้</Label>
                <Select id={`variant-${index}-skill`} {...register(`variants.${index}.requiredSkill`)}>
                  {STAFF_SKILLS.map((skill) => (
                    <option key={skill} value={skill}>
                      {STAFF_SKILL_LABEL[skill]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`variant-${index}-room-type`}>ประเภทห้องที่ต้องใช้</Label>
                {roomTypes.length === 0 ? (
                  <p className="text-pretty text-xs text-brass">สาขานี้ยังไม่มีประเภทห้องเลย</p>
                ) : (
                  <Select
                    id={`variant-${index}-room-type`}
                    {...register(`variants.${index}.requiredRoomTypeId`)}
                    defaultValue=""
                  >
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
                {variantErrors?.requiredRoomTypeId && (
                  <p className="text-pretty text-xs text-rose">{variantErrors.requiredRoomTypeId.message}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {formError && (
        <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {formError}
        </p>
      )}

      <div className="sticky -bottom-5 -mx-6 -mb-5 flex justify-end gap-3 border-t border-line bg-surface px-6 pb-5 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || categories.length === 0 || roomTypes.length === 0}
        >
          {isSubmitting ? "กำลังบันทึก..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

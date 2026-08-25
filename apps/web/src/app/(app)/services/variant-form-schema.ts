import {
  STAFF_SKILLS,
  type CreateServiceVariantInput,
  type VariantFormFormInput,
  type VariantFormInput,
} from "@lotus-desk/contracts";
import type { ServiceVariant } from "../../../lib/api-client";

export const EMPTY_VARIANT_FORM_VALUES: VariantFormFormInput = {
  durationMin: 60,
  priceBaht: 0,
  commissionJuniorBaht: 0,
  commissionSeniorBaht: 0,
  commissionMasterBaht: 0,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  requiredSkill: STAFF_SKILLS[0],
  requiredRoomTypeId: "",
};

/** บาท → สตางค์ ปัดเศษเข้าจำนวนเต็มที่ใกล้ที่สุดเสมอ (กัน float error ตกค้างก่อนเข้า DB) */
export function variantFormToApiInput(values: VariantFormInput): CreateServiceVariantInput {
  return {
    durationMin: values.durationMin,
    priceSatang: Math.round(values.priceBaht * 100),
    commissionJuniorSatang: Math.round(values.commissionJuniorBaht * 100),
    commissionSeniorSatang: Math.round(values.commissionSeniorBaht * 100),
    commissionMasterSatang: Math.round(values.commissionMasterBaht * 100),
    bufferBeforeMin: values.bufferBeforeMin,
    bufferAfterMin: values.bufferAfterMin,
    requiredSkill: values.requiredSkill,
    requiredRoomTypeId: values.requiredRoomTypeId,
  };
}

/** สตางค์ (ค่าจริงจาก API) → บาท ใช้เป็น default values ตอนแก้ไข */
export function apiVariantToFormDefaults(variant: ServiceVariant): VariantFormFormInput {
  return {
    durationMin: variant.durationMin,
    priceBaht: variant.priceSatang / 100,
    commissionJuniorBaht: variant.commissionJuniorSatang / 100,
    commissionSeniorBaht: variant.commissionSeniorSatang / 100,
    commissionMasterBaht: variant.commissionMasterSatang / 100,
    bufferBeforeMin: variant.bufferBeforeMin,
    bufferAfterMin: variant.bufferAfterMin,
    requiredSkill: variant.requiredSkill,
    requiredRoomTypeId: variant.requiredRoomTypeId,
  };
}

import type { CreatePackageInput, PackageFormInput, PackageType } from "@lotus-desk/contracts";

export const EMPTY_PACKAGE_FORM_VALUES: Record<PackageType, PackageFormInput> = {
  SESSION_COUNT: {
    type: "SESSION_COUNT",
    name: "",
    priceBaht: 0,
    validDays: 180,
    serviceVariantId: "",
    sessionCount: 1,
  },
  VALUE: { type: "VALUE", name: "", priceBaht: 0, validDays: 180, valueBaht: 0 },
  UNLIMITED_DURATION: {
    type: "UNLIMITED_DURATION",
    name: "",
    priceBaht: 0,
    validDays: 180,
    serviceVariantId: "",
  },
};

/** บาท → สตางค์ ปัดเศษเข้าจำนวนเต็มที่ใกล้ที่สุดเสมอ (กัน float error ตกค้างก่อนเข้า DB) */
export function packageFormToApiInput(values: PackageFormInput): CreatePackageInput {
  if (values.type === "SESSION_COUNT") {
    return {
      type: "SESSION_COUNT",
      name: values.name,
      priceSatang: Math.round(values.priceBaht * 100),
      validDays: values.validDays,
      serviceVariantId: values.serviceVariantId,
      sessionCount: values.sessionCount,
    };
  }
  if (values.type === "VALUE") {
    return {
      type: "VALUE",
      name: values.name,
      priceSatang: Math.round(values.priceBaht * 100),
      validDays: values.validDays,
      valueSatang: Math.round(values.valueBaht * 100),
    };
  }
  return {
    type: "UNLIMITED_DURATION",
    name: values.name,
    priceSatang: Math.round(values.priceBaht * 100),
    validDays: values.validDays,
    serviceVariantId: values.serviceVariantId,
  };
}

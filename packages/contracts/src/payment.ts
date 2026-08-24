// แหล่งชำระ — ตรงกับ enum PaymentMethod ใน packages/db/prisma/schema.prisma (ดู docs/DOMAIN.md ข้อ 10)
// ใช้ร่วมกันข้ามฟีเจอร์ (เดิมชื่อ LinePaymentMethod อยู่ใน promotion.ts เฉพาะตอน T5.4 — ย้ายมาที่นี่ตอน T5.5
// เพราะ ServiceJob ก็ต้องใช้ค่าเดียวกันเป๊ะ ไม่ใช่แค่ตะกร้าจำลองของหน้าคำนวณโปรโมชั่นอีกต่อไป)
export const PAYMENT_METHODS = ["CASH", "PACKAGE", "VOUCHER", "COMPLIMENTARY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "เงินสด/บัตร",
  PACKAGE: "ตัดคอร์ส",
  VOUCHER: "วอยเชอร์",
  COMPLIMENTARY: "อภินันทนาการ",
};

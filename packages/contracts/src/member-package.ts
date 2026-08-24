import { z } from "zod";

// ledger คอร์สที่สมาชิกถือครอง (T5.2) — append-only เสมอ (ดู CLAUDE.md ข้อ 7, docs/decisions.md ADR-026)
// ตรงกับ enum MemberPackageLedgerKind ใน packages/db/prisma/schema.prisma
export const MEMBER_PACKAGE_LEDGER_KINDS = [
  "PURCHASE",
  "USE",
  "REFUND",
  "EXPIRE",
  "FREEZE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
] as const;
export type MemberPackageLedgerKind = (typeof MEMBER_PACKAGE_LEDGER_KINDS)[number];

export const MEMBER_PACKAGE_LEDGER_KIND_LABEL: Record<MemberPackageLedgerKind, string> = {
  PURCHASE: "ซื้อ",
  USE: "ตัดใช้",
  REFUND: "คืนยอด",
  EXPIRE: "ปิดหมดอายุ",
  FREEZE: "แช่แข็ง",
  TRANSFER_OUT: "โอนออก",
  TRANSFER_IN: "รับโอนเข้า",
};

export const MEMBER_PACKAGE_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type MemberPackageStatus = (typeof MEMBER_PACKAGE_STATUSES)[number];

// ซื้อคอร์ส/แพ็กเกจให้สมาชิก — snapshot จาก Package (catalog) ตอนซื้อ ไม่ต้องส่งฟิลด์อื่นมาเอง
export const purchaseMemberPackageSchema = z.object({
  packageId: z.string().min(1, "กรุณาเลือกคอร์ส/แพ็กเกจ"),
});
export type PurchaseMemberPackageInput = z.infer<typeof purchaseMemberPackageSchema>;

// ตัดใช้คอร์ส — amount หมายถึง "จำนวนครั้ง" (SESSION_COUNT) หรือ "สตางค์ที่ตัด" (VALUE) แล้วแต่ประเภท
// ของคอร์สใบนั้น (UNLIMITED_DURATION ไม่ตรวจ amount กับยอดคงเหลือ แต่ยังต้องส่งมาเพื่อบันทึก audit)
export const useMemberPackageSchema = z.object({
  amount: z.coerce.number().int("จำนวนต้องเป็นจำนวนเต็ม").min(1, "ต้องมากกว่า 0"),
  approvedByUserId: z.string().min(1).optional(),
  note: z.string().trim().max(500).optional(),
});
export type UseMemberPackageInput = z.infer<typeof useMemberPackageSchema>;

// คืนยอด — ต้องอ้างอิงแถว USE เดิมเป๊ะ ๆ (ไม่รับจำนวนเองจากผู้เรียก) เพื่อให้ยอดตรง 100% เสมอ
// (ดู docs/PLAN.md T5.2 เกณฑ์ผ่าน "ตัดคอร์สแล้วยกเลิกบิล ต้องคืนครั้งอัตโนมัติและยอดตรง 100%")
export const refundMemberPackageSchema = z.object({
  ledgerEntryId: z.string().min(1, "กรุณาระบุรายการที่จะคืนยอด"),
  note: z.string().trim().min(1, "กรุณาระบุเหตุผลการคืนยอด").max(500),
});
export type RefundMemberPackageInput = z.infer<typeof refundMemberPackageSchema>;

// แช่แข็ง — ต้องมีผู้จัดการอนุมัติเสมอ ไม่มีข้อยกเว้น (ดู docs/DOMAIN.md ข้อ 8)
export const freezeMemberPackageSchema = z.object({
  days: z.coerce.number().int("จำนวนวันต้องเป็นจำนวนเต็ม").min(1, "ต้องมากกว่า 0"),
  approvedByUserId: z.string().min(1, "ต้องระบุผู้จัดการที่อนุมัติ"),
  note: z.string().trim().max(500).optional(),
});
export type FreezeMemberPackageInput = z.infer<typeof freezeMemberPackageSchema>;

// โอนทั้งใบให้สมาชิกอื่น (ดู docs/DOMAIN.md ข้อ 6 — ห้ามโอนบางส่วน)
export const transferMemberPackageSchema = z.object({
  toMemberId: z.string().min(1, "กรุณาเลือกสมาชิกที่จะรับโอน"),
  note: z.string().trim().max(500).optional(),
});
export type TransferMemberPackageInput = z.infer<typeof transferMemberPackageSchema>;

// ปิดคอร์สแบบ manual (ผู้จัดการตัดสินใจปิดยอดคงเหลือทิ้งถาวร) — ต้องมีผู้จัดการอนุมัติ + เหตุผลเสมอ
export const expireMemberPackageSchema = z.object({
  approvedByUserId: z.string().min(1, "ต้องระบุผู้จัดการที่อนุมัติ"),
  note: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(500),
});
export type ExpireMemberPackageInput = z.infer<typeof expireMemberPackageSchema>;

// กติกาความถูกต้องของ ledger คอร์ส/แพ็กเกจ (T5.2) — pure function เท่านั้น ไม่แตะ Prisma/DB/เวลาปัจจุบันเอง
// ผู้เรียก (apps/api) เป็นคนล็อกแถวด้วย SELECT ... FOR UPDATE + อ่านผลรวม ledger จริงจาก DB แล้วส่งเข้ามา
// ที่นี่ตัดสินแค่ว่า "การกระทำนี้ถูกต้องไหม" (business rule) ไม่ตัดสินเรื่อง concurrency (ดู docs/decisions.md ADR-026)

export type PackageType = "SESSION_COUNT" | "VALUE" | "UNLIMITED_DURATION";

/** แช่แข็งได้สูงสุดกี่วัน ต่อคอร์ส 1 ใบ ตลอดอายุการใช้งาน (ดู docs/DOMAIN.md ข้อ 8, ADR-026) */
export const MAX_FREEZE_DAYS_PER_PACKAGE = 30;

export interface ValidationOk {
  ok: true;
}
export interface ValidationFail {
  ok: false;
  reason: string;
}
export type ValidationResult = ValidationOk | ValidationFail;

export interface ValidateUseInput {
  packageType: PackageType;
  /** ผลรวม delta ปัจจุบัน (ก่อนตัดครั้งนี้) — ไม่มีความหมายสำหรับ UNLIMITED_DURATION */
  currentBalance: number;
  /** จำนวนที่จะตัด ต้องเป็นค่าบวก (ฟังก์ชันนี้จะแปลงเป็นลบเอง) */
  amount: number;
  now: Date;
  expiresAt: Date;
  /** userId ของผู้จัดการที่อนุมัติ ถ้าคอร์สหมดอายุแล้ว (ดู docs/DOMAIN.md ข้อ 5) — null ถ้ายังไม่หมดอายุ */
  approvedByUserId: string | null;
}

/** ตัดใช้คอร์ส (USE) — คืน error ถ้ายอดไม่พอ หรือหมดอายุแล้วไม่มีผู้จัดการอนุมัติ */
export function validateUse(input: ValidateUseInput): ValidationResult {
  if (input.amount <= 0) {
    return { ok: false, reason: "จำนวนที่ตัดต้องมากกว่า 0" };
  }
  if (input.now > input.expiresAt && !input.approvedByUserId) {
    return { ok: false, reason: "คอร์สหมดอายุแล้ว ต้องให้ผู้จัดการอนุมัติก่อนใช้งาน" };
  }
  if (input.packageType !== "UNLIMITED_DURATION") {
    const resultingBalance = input.currentBalance - input.amount;
    if (resultingBalance < 0) {
      return { ok: false, reason: "ยอดคงเหลือของคอร์สไม่พอ" };
    }
  }
  return { ok: true };
}

export interface ValidateRefundInput {
  /** delta ของแถว USE เดิมที่จะคืน (ค่าติดลบ) */
  originalUseDelta: number;
  /** MemberPackage ถูกปิด (CLOSED) ไปแล้วหรือยัง — คืนยอดให้ใบที่ปิดแล้วไม่ได้ */
  memberPackageStatus: "ACTIVE" | "CLOSED";
}

/** คืนยอด (REFUND) — ใช้ตอนยกเลิกบิลที่ตัดคอร์สไปแล้ว ต้องคืนเท่าที่ตัดไปเป๊ะ ๆ (ยอดตรง 100%) */
export function validateRefund(input: ValidateRefundInput): ValidationResult {
  if (input.memberPackageStatus === "CLOSED") {
    return { ok: false, reason: "คอร์สใบนี้ปิดแล้ว คืนยอดไม่ได้" };
  }
  if (input.originalUseDelta >= 0) {
    return { ok: false, reason: "แถวที่จะคืนยอดต้องเป็นรายการตัดใช้ (USE) เท่านั้น" };
  }
  return { ok: true };
}

export interface ValidateFreezeInput {
  requestedDays: number;
  /** ผลรวมวันแช่แข็งที่ใช้ไปแล้วของคอร์สใบนี้ (ตลอดอายุ ไม่ใช่ต่อปีปฏิทิน — ดู ADR-026) */
  cumulativeFreezeDaysUsed: number;
  /** แช่แข็งต้องมีผู้จัดการอนุมัติเสมอ ไม่มีข้อยกเว้น (ดู docs/DOMAIN.md ข้อ 8) */
  approvedByUserId: string | null;
  memberPackageStatus: "ACTIVE" | "CLOSED";
}

/** แช่แข็งคอร์ส (FREEZE) — ไม่กระทบยอดคงเหลือ แค่ขยาย expiresAt ต้องอยู่ในโควตา 30 วัน/ใบ */
export function validateFreeze(input: ValidateFreezeInput): ValidationResult {
  if (input.memberPackageStatus === "CLOSED") {
    return { ok: false, reason: "คอร์สใบนี้ปิดแล้ว แช่แข็งไม่ได้" };
  }
  if (!input.approvedByUserId) {
    return { ok: false, reason: "ต้องให้ผู้จัดการอนุมัติการแช่แข็งคอร์สทุกครั้ง" };
  }
  if (!Number.isInteger(input.requestedDays) || input.requestedDays <= 0) {
    return { ok: false, reason: "จำนวนวันแช่แข็งต้องเป็นจำนวนเต็มมากกว่า 0" };
  }
  if (input.cumulativeFreezeDaysUsed + input.requestedDays > MAX_FREEZE_DAYS_PER_PACKAGE) {
    return {
      ok: false,
      reason: `แช่แข็งได้สูงสุด ${MAX_FREEZE_DAYS_PER_PACKAGE} วันต่อคอร์ส 1 ใบ (ใช้ไปแล้ว ${input.cumulativeFreezeDaysUsed} วัน)`,
    };
  }
  return { ok: true };
}

export interface ValidateTransferInput {
  fromMemberId: string;
  toMemberId: string;
  memberPackageStatus: "ACTIVE" | "CLOSED";
  currentBalance: number;
  packageType: PackageType;
}

/** โอนคอร์สทั้งใบให้สมาชิกอื่น (ดู docs/DOMAIN.md ข้อ 6 — ห้ามโอนบางส่วน) */
export function validateTransfer(input: ValidateTransferInput): ValidationResult {
  if (input.memberPackageStatus === "CLOSED") {
    return { ok: false, reason: "คอร์สใบนี้ปิดแล้ว โอนไม่ได้" };
  }
  if (input.fromMemberId === input.toMemberId) {
    return { ok: false, reason: "โอนให้ตัวเองไม่ได้" };
  }
  if (input.packageType !== "UNLIMITED_DURATION" && input.currentBalance <= 0) {
    return { ok: false, reason: "คอร์สใบนี้ไม่มียอดคงเหลือให้โอน" };
  }
  return { ok: true };
}

export interface ValidateExpireInput {
  memberPackageStatus: "ACTIVE" | "CLOSED";
  /** ปิดหมดอายุแบบ manual ต้องมีผู้จัดการอนุมัติเสมอ (สละสิทธิ์ยอดคงเหลือของลูกค้าถาวร) */
  approvedByUserId: string | null;
}

/** ปิดคอร์สแบบ manual (EXPIRE) — เจ้าของ/ผู้จัดการตัดสินใจปิดยอดคงเหลือทิ้งถาวร ไม่ใช่ auto-run ตามเวลา */
export function validateExpire(input: ValidateExpireInput): ValidationResult {
  if (input.memberPackageStatus === "CLOSED") {
    return { ok: false, reason: "คอร์สใบนี้ปิดแล้ว" };
  }
  if (!input.approvedByUserId) {
    return { ok: false, reason: "ต้องให้ผู้จัดการอนุมัติก่อนปิดคอร์สที่หมดอายุ" };
  }
  return { ok: true };
}

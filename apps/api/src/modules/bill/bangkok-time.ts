/**
 * แปลง instant (UTC) ให้เป็นวันที่ตามปฏิทินไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST) — ใช้หาว่า Bill.createdAt
 * (เวลาที่เช็คเอาต์จริง) ตรงกับวันปฏิทินไทยวันไหน เพื่อจับคู่กับ TimeClockEntry ของพนักงานที่ลงเวลาวันนั้น
 * (T6.3, ดู docs/decisions.md ADR-032) ใช้เทคนิคเดียวกับ apps/api/src/modules/attendance/bangkok-time.ts
 * และ apps/api/src/modules/promotion/bangkok-time.ts — แยกไฟล์ต่างหากแทนที่จะแก้ของเดิม เพราะเป็นคนละโมดูล
 * ไม่อยากผูก bill module เข้ากับ attendance/promotion โดยไม่จำเป็น (แพทเทิร์นนี้ตั้งใจ duplicate ทีละโมดูล)
 */
export function toBangkokDateOnly(instant: Date): Date {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate()));
}

/** ช่วง UTC instant ที่ครอบวันปฏิทินไทยทั้งวันของ instant ที่ให้มา — ใช้ query ช่วง TimeClockEntry.clockInAt */
export function bangkokDayRange(instant: Date): { start: Date; end: Date } {
  const dateOnly = toBangkokDateOnly(instant);
  const start = new Date(dateOnly.getTime() - 7 * 60 * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

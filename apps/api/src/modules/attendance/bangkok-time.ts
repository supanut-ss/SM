/**
 * แปลง instant (UTC) เป็นองค์ประกอบเวลาตามผนังเวลาไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST) — ใช้เตรียม
 * input ให้ evaluateAttendance (T6.1, packages/core/attendance) ซึ่งเป็น pure function ที่ไม่ยอมรับ Date
 * ตรง ๆ ใช้เทคนิคเดียวกับ apps/api/src/modules/promotion/bangkok-time.ts และ
 * apps/api/src/modules/booking/bangkok-date.ts — แยกไฟล์ต่างหากแทนที่จะแก้ของเดิม เพราะเป็นคนละโมดูล
 * ไม่อยากผูก attendance module เข้ากับ promotion/booking โดยไม่จำเป็น
 */
export function bangkokMinuteOfDay(instant: Date): number {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return bangkok.getUTCHours() * 60 + bangkok.getUTCMinutes();
}

/**
 * แปลง instant (UTC) ให้เป็นวันที่ตามปฏิทินไทย คืนเป็น Date เที่ยงคืน UTC ของวันนั้น — ให้ตรงกับที่ Prisma
 * แมป field `@db.Date` (เก็บแค่วันที่ ไม่มีเวลา) ใช้จับคู่ TimeClockEntry.clockInAt กับ StaffShift.date
 */
export function toBangkokDateOnly(instant: Date): Date {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate()));
}

/** ช่วง UTC instant ที่ครอบวันปฏิทินไทยทั้งวันของ instant ที่ให้มา — ใช้ query ช่วง clockInAt (GET /) */
export function bangkokDayRange(instant: Date): { start: Date; end: Date } {
  const dateOnly = toBangkokDateOnly(instant);
  const start = new Date(dateOnly.getTime() - 7 * 60 * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

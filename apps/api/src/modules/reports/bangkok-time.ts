/**
 * แปลง instant (UTC) ให้เป็นวันที่ตามปฏิทินไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST) — ใช้เตรียมช่วง
 * [start, end) ของ UTC instant ที่ครอบวันปฏิทินไทยหนึ่งวัน สำหรับ query Bill/MemberPackage/AppointmentItem
 * ฯลฯ ใน DailySummaryService (T7.1) ใช้เทคนิคเดียวกับ apps/api/src/modules/attendance/bangkok-time.ts และ
 * apps/api/src/modules/promotion/bangkok-time.ts — แยกไฟล์ต่างหากแทนที่จะแก้ของเดิม เพราะเป็นคนละโมดูล
 * ไม่อยากผูก reports module เข้ากับ attendance/promotion โดยไม่จำเป็น (ดู doc-comment ของไฟล์เหล่านั้น)
 */

/** แปลง instant (UTC) ให้เป็นวันที่ตามปฏิทินไทย คืนเป็น Date เที่ยงคืน UTC ของวันนั้น — ให้ตรงกับที่ Prisma
 * แมป field `@db.Date` (เก็บแค่วันที่ ไม่มีเวลา) ใช้เป็นค่า `date` ของ DailySummary/DailyStaffSummary
 */
export function toBangkokDateOnly(instant: Date): Date {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate()));
}

/** ช่วง UTC instant ที่ครอบวันปฏิทินไทยทั้งวันของ instant ที่ให้มา — ใช้ query ช่วง createdAt/startAt/purchasedAt */
export function bangkokDayRange(instant: Date): { start: Date; end: Date } {
  const dateOnly = toBangkokDateOnly(instant);
  const start = new Date(dateOnly.getTime() - 7 * 60 * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

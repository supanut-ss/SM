/**
 * แปลง instant (UTC) เป็นองค์ประกอบเวลาตามผนังเวลาไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST) — ใช้เตรียม
 * input ให้ evaluatePromotions (T5.3, packages/core/promotion) ซึ่งเป็น pure function ที่ไม่ยอมรับ Date
 * ตรง ๆ (ต้องแปลงเป็นเวลาไทยก่อนเสมอ ไม่งั้น Date.getDay()/getHours() จะได้ timezone ของเครื่อง server
 * ไม่ใช่เวลาไทย) ใช้เทคนิคเดียวกับ apps/api/src/modules/booking/bangkok-date.ts (T4.1/T4.4/T4.6) — แยกไฟล์
 * ต่างหากแทนที่จะแก้ของเดิม เพราะเป็นคนละโมดูล ไม่อยากผูก booking module เข้ากับ promotion โดยไม่จำเป็น
 */
export function bangkokDayOfWeek(instant: Date): number {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return bangkok.getUTCDay();
}

export function bangkokMinuteOfDay(instant: Date): number {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return bangkok.getUTCHours() * 60 + bangkok.getUTCMinutes();
}

export function bangkokMonth(instant: Date): number {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return bangkok.getUTCMonth() + 1;
}

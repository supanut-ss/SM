/**
 * แปลง instant (UTC) ให้เป็นวันที่ตามปฏิทินไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST) คืนเป็น Date เที่ยงคืน
 * UTC ของวันนั้น — ให้ตรงกับที่ Prisma แมป field `@db.Date` (เก็บแค่วันที่ ไม่มีเวลา) ใช้หาว่า
 * AppointmentItem.startAt ตกอยู่ "วันไหน" สำหรับ StaffQueueEntry.date (T4.4) ดู CLAUDE.md ข้อ 3
 */
export function toBangkokDateOnly(instant: Date): Date {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate()));
}

/** ช่วง UTC instant ที่ครอบวันปฏิทินไทยทั้งวันของ instant ที่ให้มา — ใช้ query ช่วง startAt (T4.5 Lane Board) */
export function bangkokDayRange(instant: Date): { start: Date; end: Date } {
  const dateOnly = toBangkokDateOnly(instant);
  const start = new Date(dateOnly.getTime() - 7 * 60 * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

/**
 * "label" วันที่ (จาก toBangkokDateOnly — เช่น StaffShift.date) + นาทีจากเที่ยงคืนตามผนังไทย → instant จริง
 * (UTC) — ใช้แปลง StaffShift.startMin/endMin (T2.4) เป็น Date จริงให้ findAvailableSlots (T4.1) กิน (T4.6)
 */
export function bangkokMinutesToInstant(dateLabel: Date, minutesFromMidnight: number): Date {
  const bangkokMidnight = dateLabel.getTime() - 7 * 60 * 60_000;
  return new Date(bangkokMidnight + minutesFromMidnight * 60_000);
}

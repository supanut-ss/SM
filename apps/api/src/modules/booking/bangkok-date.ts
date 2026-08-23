/**
 * แปลง instant (UTC) ให้เป็นวันที่ตามปฏิทินไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST) คืนเป็น Date เที่ยงคืน
 * UTC ของวันนั้น — ให้ตรงกับที่ Prisma แมป field `@db.Date` (เก็บแค่วันที่ ไม่มีเวลา) ใช้หาว่า
 * AppointmentItem.startAt ตกอยู่ "วันไหน" สำหรับ StaffQueueEntry.date (T4.4) ดู CLAUDE.md ข้อ 3
 */
export function toBangkokDateOnly(instant: Date): Date {
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60_000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate()));
}

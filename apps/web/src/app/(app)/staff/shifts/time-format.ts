/** นาทีจากเที่ยงคืน (0-1439) → "HH:mm" สำหรับ <input type="time"> และแสดงผล */
export function minToTimeString(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "HH:mm" จาก <input type="time"> → นาทีจากเที่ยงคืน */
export function timeStringToMin(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Date → "YYYY-MM-DD" (local — ปฏิทินกะทำงานเป็นวันตามผนัง ไม่ใช่ instant ข้าม timezone) */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const THAI_WEEKDAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

/** จันทร์ของสัปดาห์ที่มี `date` อยู่ */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = (d.getDay() + 6) % 7; // 0 = จันทร์
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function weekdayLabel(index: number): string {
  return THAI_WEEKDAYS[index] ?? "";
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** "2026-08-24T00:00:00.000Z" (ค่าจาก API สำหรับคอลัมน์ @db.Date) → "2026-08-24" */
export function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

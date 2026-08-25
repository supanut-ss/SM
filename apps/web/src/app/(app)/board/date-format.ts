/** Date (เวลาเครื่องผู้ใช้) → "YYYY-MM-DD" ตามผนัง — ใช้เป็น query param "date" ของ endpoint ต่าง ๆ */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** วันที่ + เวลาไทย (ชม./นาที) → instant จริง (UTC) — ใช้คำนวณจุดเริ่ม/จบของกระดาน (T4.5) */
export function bangkokInstant(dateKey: string, hour: number, minute = 0): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hour - 7, minute));
}

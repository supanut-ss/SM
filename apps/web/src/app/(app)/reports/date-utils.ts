/** "YYYY-MM-DD" ของวันนี้ตามปฏิทินไทย (Asia/Bangkok) — en-CA locale จัดรูปแบบเป็น YYYY-MM-DD ให้ตรง ๆ
 * (แพทเทิร์นเดียวกับ dormant-customers-section.tsx ที่ format ด้วย timeZone: "Asia/Bangkok") */
export function todayBangkokIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** เลื่อนวันที่แบบ "YYYY-MM-DD" ไป N วัน (N ติดลบได้) — คำนวณด้วย UTC เที่ยงคืนล้วน เลี่ยงปัญหา DST/timezone
 * shift เพราะเราสนใจแค่ตัวเลขปฏิทิน ไม่ใช่ช่วงเวลาใดช่วงเวลาหนึ่งจริง */
export function shiftIsoDate(iso: string, days: number): string {
  const parts = iso.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** ช่วงวันที่เริ่มต้นเมื่อไม่มีตัวกรองใน URL — 30 วันล่าสุดนับรวมวันนี้ */
export function defaultDateRange(): { from: string; to: string } {
  const to = todayBangkokIso();
  return { from: shiftIsoDate(to, -29), to };
}

/** "YYYY-MM-DD" → "1 ม.ค. 2569" (แสดงในกราฟ/แกน X) */
export function formatDateShortThai(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * แปลงสตางค์ (integer เก็บใน DB — ดู CLAUDE.md ข้อ 2) เป็นข้อความบาทสำหรับแสดงผล
 * ตาม docs/DESIGN.md §3.8: "฿1,250" (ไม่มีทศนิยมถ้าลงตัว) — ใช้คู่กับ font-data (tabular-nums) เสมอ
 */
export function formatSatang(satang: number): string {
  const baht = satang / 100;
  const hasFraction = !Number.isInteger(baht);
  return `฿${baht.toLocaleString("th-TH", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

import type { DailySummaryRow } from "../../../lib/api-client";

/** สตางค์ → สตริงบาทดิบ 2 ตำแหน่ง (ไม่ใส่ ฿ หรือ comma คั่นหลักพัน — ให้ Excel อ่านเป็นตัวเลขได้ตรง ๆ) */
function satangToBahtCell(satang: number): string {
  return (satang / 100).toFixed(2);
}

/** ครอบด้วย "..." เมื่อค่ามี comma/quote/newline (กฎ CSV มาตรฐาน) */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const CSV_HEADERS = [
  "วันที่",
  "รายได้รับรู้ (บาท)",
  "เงินเข้าจริง (บาท)",
  "เงินเข้าจากคอร์ส (บาท)",
  "ชำระเงินสด/บัตร (บาท)",
  "ชำระตัดคอร์ส (บาท)",
  "ชำระวอยเชอร์ (บาท)",
  "ชำระอภินันทนาการ (บาท)",
  "คอร์สขายได้ (ใบ)",
  "คอร์สขายได้ (บาท)",
  "คอร์สถูกตัดใช้ (ครั้ง)",
  "ลูกค้าใหม่",
  "ลูกค้าเก่า",
  "ไม่มาตามนัด",
];

/** สร้างเนื้อหา CSV จากรายวันของ /daily-summary (ไม่มี library — ADR-035 วางบรรทัดฐานไว้แล้วสำหรับ T6.4) */
export function buildDailySummaryCsv(days: DailySummaryRow[]): string {
  const rows = days.map((day) => [
    day.date.slice(0, 10),
    satangToBahtCell(day.recognizedRevenueSatang),
    satangToBahtCell(day.cashInSatang),
    satangToBahtCell(day.cashInPackageSatang),
    satangToBahtCell(day.paymentCashSatang),
    satangToBahtCell(day.paymentPackageSatang),
    satangToBahtCell(day.paymentVoucherSatang),
    satangToBahtCell(day.paymentComplimentarySatang),
    String(day.courseSoldCount),
    satangToBahtCell(day.courseSoldValueSatang),
    String(day.courseUsedCount),
    String(day.newCustomerCount),
    String(day.returningCustomerCount),
    String(day.noShowCount),
  ]);

  return [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/**
 * ทริกเกอร์ดาวน์โหลดไฟล์ CSV ในเบราว์เซอร์ — เติม UTF-8 BOM (U+FEFF) นำหน้าเสมอ เพราะ Excel บน Windows
 * เดาเป็น ANSI ผิดตัวเมื่อเปิดไฟล์ CSV ที่มีภาษาไทยแต่ไม่มี BOM (ปัญหารู้จักกันดีของ Excel ไม่เกี่ยวกับ repo นี้)
 * ใช้ String.fromCharCode แทนการพิมพ์อักขระ BOM ตรง ๆ ในซอร์สโค้ด เพราะ eslint no-irregular-whitespace
 * (และ editor ส่วนใหญ่) มองอักขระนี้เป็นช่องว่างแปลกปลอมที่มองไม่เห็น
 */
const UTF8_BOM = String.fromCharCode(0xfeff);

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([UTF8_BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

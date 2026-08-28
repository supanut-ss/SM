import ExcelJS from "exceljs";
import type { DailySummaryRow } from "../../../lib/api-client";

/**
 * สร้างไฟล์ Excel จริง (.xlsx) จากรายวันของ /daily-summary ในเบราว์เซอร์ล้วน ๆ ไม่มี round-trip ไปเซิร์ฟเวอร์
 * (ผู้จัดการอนุมัติเพิ่ม dependency `exceljs` แล้วเฉพาะฝั่ง apps/web — ดู CLAUDE.md ข้อ "ห้ามเพิ่ม dependency
 * ใหม่โดยไม่ถาม") ใช้แนวทางคอลัมน์/รูปแบบเดียวกับ payroll.controller.ts summaryXlsx() ฝั่ง apps/api:
 * คอลัมน์เงินแปลงจากสตางค์เป็นบาทแล้วใส่เป็นตัวเลข (ไม่ใช่สตริง) ให้ Excel sum/สร้างกราฟได้ตรง ๆ
 *
 * ต่างจาก CSV เดิม (ADR-035) ตรงที่ไฟล์ .xlsx เป็น zip binary ที่มี encoding ระบุไว้ในตัวเองอยู่แล้ว — ไม่ต้อง
 * เติม UTF-8 BOM แบบที่ downloadCsv เดิมทำ (BOM แก้ปัญหา Excel เดาผิดเฉพาะไฟล์ข้อความ CSV เท่านั้น)
 */

interface ColumnDef {
  header: string;
  key: string;
  width: number;
}

const COLUMNS: ColumnDef[] = [
  { header: "วันที่", key: "date", width: 14 },
  { header: "รายได้รับรู้ (บาท)", key: "recognizedRevenueBaht", width: 18 },
  { header: "เงินเข้าจริง (บาท)", key: "cashInBaht", width: 16 },
  { header: "เงินเข้าจากคอร์ส (บาท)", key: "cashInPackageBaht", width: 18 },
  { header: "ชำระเงินสด/บัตร (บาท)", key: "paymentCashBaht", width: 18 },
  { header: "ชำระตัดคอร์ส (บาท)", key: "paymentPackageBaht", width: 16 },
  { header: "ชำระวอยเชอร์ (บาท)", key: "paymentVoucherBaht", width: 16 },
  { header: "ชำระอภินันทนาการ (บาท)", key: "paymentComplimentaryBaht", width: 18 },
  { header: "ชำระโอน/พร้อมเพย์ (บาท)", key: "paymentTransferBaht", width: 18 },
  { header: "คอร์สขายได้ (ใบ)", key: "courseSoldCount", width: 14 },
  { header: "คอร์สขายได้ (บาท)", key: "courseSoldValueBaht", width: 16 },
  { header: "คอร์สถูกตัดใช้ (ครั้ง)", key: "courseUsedCount", width: 16 },
  { header: "ลูกค้าใหม่", key: "newCustomerCount", width: 12 },
  { header: "ลูกค้าเก่า", key: "returningCustomerCount", width: 12 },
  { header: "ไม่มาตามนัด", key: "noShowCount", width: 12 },
];

/** สตางค์ → บาท (ตัวเลข ไม่ใช่สตริง) ให้ Excel sum/สร้างกราฟได้ตรง ๆ */
function satangToBaht(satang: number): number {
  return satang / 100;
}

/** สร้าง workbook ExcelJS จากรายวันของ /daily-summary */
export async function buildDailySummaryWorkbook(days: DailySummaryRow[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("สรุปรายวัน");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const day of days) {
    sheet.addRow({
      date: day.date.slice(0, 10),
      recognizedRevenueBaht: satangToBaht(day.recognizedRevenueSatang),
      cashInBaht: satangToBaht(day.cashInSatang),
      cashInPackageBaht: satangToBaht(day.cashInPackageSatang),
      paymentCashBaht: satangToBaht(day.paymentCashSatang),
      paymentPackageBaht: satangToBaht(day.paymentPackageSatang),
      paymentVoucherBaht: satangToBaht(day.paymentVoucherSatang),
      paymentComplimentaryBaht: satangToBaht(day.paymentComplimentarySatang),
      paymentTransferBaht: satangToBaht(day.paymentTransferSatang),
      courseSoldCount: day.courseSoldCount,
      courseSoldValueBaht: satangToBaht(day.courseSoldValueSatang),
      courseUsedCount: day.courseUsedCount,
      newCustomerCount: day.newCustomerCount,
      returningCustomerCount: day.returningCustomerCount,
      noShowCount: day.noShowCount,
    });
  }

  return workbook;
}

/** ทริกเกอร์ดาวน์โหลดไฟล์ .xlsx ในเบราว์เซอร์ จาก workbook ที่สร้างไว้แล้ว */
export async function downloadDailySummaryXlsx(filename: string, days: DailySummaryRow[]): Promise<void> {
  const workbook = await buildDailySummaryWorkbook(days);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

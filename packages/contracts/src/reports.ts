import { z } from "zod";

// รายงาน (T7.2) — query param ของ endpoint อ่านอย่างเดียวใน apps/api/src/modules/reports/reports.controller.ts
// หมายเหตุ: คอนโทรลเลอร์เองแยก parse วันที่ "YYYY-MM-DD" ด้วยมือ (แพทเทิร์นเดียวกับ AttendanceController/
// parseDateOnlyParam) ไม่ได้ผูก schema พวกนี้ผ่าน ZodValidationPipe เพราะ query param ในโค้ดฐานนี้ไม่เคยผ่าน
// Zod pipe เลยสักที่ (ดู StaffController.list/BillController.list/AttendanceController.list) — schema พวกนี้
// ยังมีประโยชน์เป็น contract ที่ใช้ร่วมกับ apps/web ได้ตอนสร้างฟอร์มตัวกรองรายงาน (T7.4) และ document รูปแบบ
// query ที่ endpoint คาดหวังไว้ให้ตรวจสอบเองได้ (unit test ในไฟล์นี้)

/** "YYYY-MM-DD" เท่านั้น (ตรงกับ parseDateOnlyParam ของคอนโทรลเลอร์) */
const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD");

export const dailySummaryRangeQuerySchema = z.object({
  from: dateOnlyString,
  to: dateOnlyString,
});

export type DailySummaryRangeQuery = z.infer<typeof dailySummaryRangeQuerySchema>;

export const staffUtilizationQuerySchema = z.object({
  from: dateOnlyString,
  to: dateOnlyString,
  staffId: z.string().min(1).optional(),
});

export type StaffUtilizationQuery = z.infer<typeof staffUtilizationQuerySchema>;

export const coursesExpiringQuerySchema = z.object({
  withinDays: z.coerce.number().int().positive().optional(),
});

export type CoursesExpiringQuery = z.infer<typeof coursesExpiringQuerySchema>;

export const dormantCustomersQuerySchema = z.object({
  daysSinceLastVisit: z.coerce.number().int().positive().optional(),
});

export type DormantCustomersQuery = z.infer<typeof dormantCustomersQuerySchema>;

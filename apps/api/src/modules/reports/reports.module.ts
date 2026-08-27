import { Module } from "@nestjs/common";
import { DailySummaryQueue } from "./daily-summary.queue";
import { DailySummaryService } from "./daily-summary.service";

/**
 * รายงาน (M7) — T7.1 มีแค่ job สรุปรายวัน + backfill ไม่มี HTTP controller ใน Task นี้ (T7.2 ค่อยเพิ่ม
 * endpoint อ่านข้อมูล) ไม่ต้อง import AuthModule/RbacModule เพราะไม่มี endpoint ที่ต้องเช็คสิทธิ์
 * export DailySummaryService ไว้ให้ backfill script (bootstrap ผ่าน NestFactory.createApplicationContext)
 * ดึงไปใช้ตรง ๆ ได้
 */
@Module({
  providers: [DailySummaryService, DailySummaryQueue],
  exports: [DailySummaryService],
})
export class ReportsModule {}

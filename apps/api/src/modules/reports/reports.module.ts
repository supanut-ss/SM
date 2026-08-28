import { Module } from "@nestjs/common";
import { DailySummaryQueue } from "./daily-summary.queue";
import { DailySummaryService } from "./daily-summary.service";
import { ReportsController } from "./reports.controller";

/**
 * รายงาน (M7) — T7.1 มีแค่ job สรุปรายวัน + backfill, T7.2 เพิ่ม ReportsController (endpoint อ่านข้อมูล)
 * ไม่ต้อง import AuthModule/RbacModule เพราะทั้งคู่เป็น @Global() (ดู ADR-006 เหมือน StaffModule/PayrollModule)
 * export DailySummaryService ไว้ให้ backfill script (bootstrap ผ่าน NestFactory.createApplicationContext)
 * ดึงไปใช้ตรง ๆ ได้ และให้ ReportsController.today เรียก computeForBranchAndDate ตรง ๆ ด้วย
 */
@Module({
  controllers: [ReportsController],
  providers: [DailySummaryService, DailySummaryQueue],
  exports: [DailySummaryService],
})
export class ReportsModule {}

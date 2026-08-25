import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [AttendanceController],
})
export class AttendanceModule {}

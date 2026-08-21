import { Module } from "@nestjs/common";
import { StaffController } from "./staff.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [StaffController],
})
export class StaffModule {}

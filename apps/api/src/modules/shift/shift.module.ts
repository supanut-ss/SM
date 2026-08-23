import { Module } from "@nestjs/common";
import { ShiftTemplateController } from "./shift-template.controller";
import { StaffShiftController } from "./staff-shift.controller";
import { StaffLeaveController } from "./staff-leave.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [ShiftTemplateController, StaffShiftController, StaffLeaveController],
})
export class ShiftModule {}

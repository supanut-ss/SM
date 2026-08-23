import { Module } from "@nestjs/common";
import { AppointmentItemController } from "./appointment-item.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [AppointmentItemController],
})
export class BookingModule {}

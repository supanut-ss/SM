import { Module } from "@nestjs/common";
import { AppointmentItemController } from "./appointment-item.controller";
import { StaffQueueController } from "./staff-queue.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [AppointmentItemController, StaffQueueController],
})
export class BookingModule {}

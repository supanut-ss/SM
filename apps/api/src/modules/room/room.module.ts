import { Module } from "@nestjs/common";
import { RoomController } from "./room.controller";
import { RoomTypeController } from "./room-type.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [RoomController, RoomTypeController],
})
export class RoomModule {}

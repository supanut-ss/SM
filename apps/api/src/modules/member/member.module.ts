import { Module } from "@nestjs/common";
import { MemberController } from "./member.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [MemberController],
})
export class MemberModule {}

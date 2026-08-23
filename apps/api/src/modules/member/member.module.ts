import { Module } from "@nestjs/common";
import { MemberController } from "./member.controller";
import { MemberConsentController } from "./member-consent.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [MemberController, MemberConsentController],
})
export class MemberModule {}

import { Module } from "@nestjs/common";
import { PackageController } from "./package.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [PackageController],
})
export class PackageModule {}

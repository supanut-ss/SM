import { Global, Module } from "@nestjs/common";
import { PermissionGuard } from "./permission.guard";

// @Global เหตุผลเดียวกับ AuthModule — ทุก feature module ที่ต้องบังคับสิทธิ์ต่อสาขาใช้ guard นี้ได้เลย
@Global()
@Module({
  providers: [PermissionGuard],
  exports: [PermissionGuard],
})
export class RbacModule {}

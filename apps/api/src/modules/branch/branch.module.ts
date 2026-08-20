import { Module } from "@nestjs/common";
import { BranchController } from "./branch.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (มีคนหนึ่งใน AppModule เรียกแล้ว)
// JwtAuthGuard และ PermissionGuard ที่ใช้ใน BranchController จึง resolve ได้เลย
@Module({
  controllers: [BranchController],
})
export class BranchModule {}

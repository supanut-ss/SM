import { Module } from "@nestjs/common";
import { MemberPackageModule } from "../member-package/member-package.module";
import { BillController } from "./bill.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006) แต่ต้อง import
// MemberPackageModule ตรง ๆ เพื่อใช้ MemberPackageService (lock/getBalance) ตอนตัด/คืนยอดคอร์สในบิล
@Module({
  imports: [MemberPackageModule],
  controllers: [BillController],
})
export class BillModule {}

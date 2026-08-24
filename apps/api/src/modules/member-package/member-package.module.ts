import { Module } from "@nestjs/common";
import { MemberPackageActionController } from "./member-package-action.controller";
import { MemberPackageController } from "./member-package.controller";
import { MemberPackageService } from "./member-package.service";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [MemberPackageController, MemberPackageActionController],
  providers: [MemberPackageService],
  // export ให้ BillModule (T5.6) เรียกใช้ lock/getBalance/validateRefund ตอนคืนยอดคอร์สที่ตัดไปแล้วตอน
  // ยกเลิกบิล — ใช้ตรรกะ lock+ledger เดียวกับ T5.2 เป๊ะ ไม่เขียนซ้ำ
  exports: [MemberPackageService],
})
export class MemberPackageModule {}

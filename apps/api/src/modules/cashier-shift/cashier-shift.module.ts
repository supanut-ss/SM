import { Module } from "@nestjs/common";
import { CashierShiftController } from "./cashier-shift.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006) AuthService ใช้แค่
// verifyManagerApprovalToken (กลไกเดียวกับ BillModule ใน T5.6)
@Module({
  controllers: [CashierShiftController],
})
export class CashierShiftModule {}

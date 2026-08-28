import { Module } from "@nestjs/common";
import { PayrollController } from "./payroll.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006) AuthService ใช้แค่
// verifyManagerApprovalToken (กลไกเดียวกับ CashierShiftModule ใน T5.7 / BillModule ใน T5.6)
@Module({
  controllers: [PayrollController],
})
export class PayrollModule {}

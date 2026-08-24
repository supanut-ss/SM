import { Module } from "@nestjs/common";
import { CouponController } from "./coupon.controller";
import { PromotionCalculatorController } from "./promotion-calculator.controller";
import { PromotionController } from "./promotion.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [PromotionController, CouponController, PromotionCalculatorController],
})
export class PromotionModule {}

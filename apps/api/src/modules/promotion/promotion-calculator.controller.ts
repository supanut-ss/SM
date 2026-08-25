import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { calculatePromotionsSchema, type CalculatePromotionsInput } from "@lotus-desk/contracts";
import { evaluatePromotions } from "@lotus-desk/core";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { bangkokDayOfWeek, bangkokMinuteOfDay, bangkokMonth } from "./bangkok-time";
import { resolveUsablePromotions, toPromotionRule } from "./promotion-rules";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * หน้าทดลองคำนวณ (T5.4) — "ใส่ตะกร้าจำลองแล้วดูว่าโปรฯ ไหนจับ ลดเท่าไร เพราะอะไร" ไม่บันทึกอะไรลง DB เลย
 * เรียก evaluatePromotions (T5.3) จริงตรง ๆ ด้วยโปรโมชั่นที่ active ทั้งหมดของสาขา — ตรรกะเลือกโปรฯ ที่ใช้
 * ได้จริง (อัตโนมัติ vs ต้องมีคูปอง) อยู่ใน resolveUsablePromotions ใช้ร่วมกับ checkout บิลจริง (T5.6)
 */
@Controller("branches/:branchId/promotions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PromotionCalculatorController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("calculate")
  @RequirePermission("view", "promotion")
  async calculate(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(calculatePromotionsSchema)) body: CalculatePromotionsInput,
  ) {
    const { usablePromotions, couponError } = await resolveUsablePromotions(
      this.prisma,
      branch.branchId,
      body.couponCode,
    );

    const now = new Date();
    const result = evaluatePromotions({
      dayOfWeek: bangkokDayOfWeek(now),
      minuteOfDay: bangkokMinuteOfDay(now),
      currentMonth: bangkokMonth(now),
      branchId: branch.branchId,
      memberTier: body.memberTier ?? null,
      isFirstTimeCustomer: body.isFirstTimeCustomer,
      memberBirthMonth: body.memberBirthMonth ?? null,
      cart: body.cart,
      promotions: usablePromotions.map(toPromotionRule),
    });

    return { ...result, couponError };
  }
}

import { Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createCouponSchema,
  updateCouponSchema,
  type CreateCouponInput,
  type UpdateCouponInput,
} from "@lotus-desk/contracts";
import { Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * คูปอง (T5.4) — nested ใต้ /branches/:branchId/promotions/:promotionId/coupons เหมือนแพทเทิร์นของ
 * MemberConsentController มีแค่ catalog CRUD ยังไม่มี logic การแลกใช้จริง (รอ T5.6 บิลเรียกใช้)
 */
@Controller("branches/:branchId/promotions/:promotionId/coupons")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CouponController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "promotion")
  async list(@CurrentBranch() branch: BranchContext, @Param("promotionId") promotionId: string) {
    await this.assertPromotionInBranch(branch.branchId, promotionId);
    return this.prisma.client.coupon.findMany({ where: { promotionId }, orderBy: { createdAt: "desc" } });
  }

  @Post()
  @RequirePermission("manage", "promotion")
  @AuditEntity("Coupon")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Param("promotionId") promotionId: string,
    @Body(new ZodValidationPipe(createCouponSchema)) body: CreateCouponInput,
  ) {
    await this.assertPromotionInBranch(branch.branchId, promotionId);
    try {
      return await this.prisma.client.coupon.create({
        data: { branchId: branch.branchId, promotionId, ...body },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("รหัสคูปองนี้ถูกใช้ไปแล้วในสาขานี้");
      }
      throw err;
    }
  }

  @Patch(":couponId")
  @RequirePermission("manage", "promotion")
  @AuditEntity("Coupon")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("promotionId") promotionId: string,
    @Param("couponId") couponId: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) body: UpdateCouponInput,
  ) {
    await this.assertPromotionInBranch(branch.branchId, promotionId);
    const existing = await this.prisma.client.coupon.findUnique({ where: { id: couponId } });
    if (!existing || existing.promotionId !== promotionId) {
      throw new NotFoundException("ไม่พบคูปองนี้");
    }
    return this.prisma.client.coupon.update({ where: { id: couponId }, data: body });
  }

  private async assertPromotionInBranch(branchId: string, promotionId: string): Promise<void> {
    const promotion = await this.prisma.client.promotion.findUnique({ where: { id: promotionId } });
    if (!promotion || promotion.branchId !== branchId) {
      throw new NotFoundException("ไม่พบโปรโมชั่นนี้");
    }
  }
}

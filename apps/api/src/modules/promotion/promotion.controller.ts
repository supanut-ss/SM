import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createPromotionSchema,
  updatePromotionSchema,
  type CreatePromotionInput,
  type UpdatePromotionInput,
} from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * โปรโมชั่น (T5.4) — catalog ของกติกาที่ evaluatePromotions (T5.3, packages/core/promotion) กินเป็น input
 * แก้ไขได้ทีหลังแค่ name/priority/quotaTotal/isActive/เงื่อนไข — ห้ามแก้ type หรือฟิลด์ส่วนลด/ของแถมเฉพาะ
 * ประเภทหลังสร้างแล้ว (เหมือนหลักการเดียวกับ PackageController ใน T5.1) ดู docs/decisions.md ADR-028
 */
@Controller("branches/:branchId/promotions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PromotionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "promotion")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("q") q?: string,
    @Query("isActive") isActiveParam?: string,
  ) {
    const isActive = isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    return this.prisma.forBranch(branch.branchId).promotion.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(trimmedQuery ? { name: { contains: trimmedQuery, mode: "insensitive" } } : {}),
      },
      orderBy: { priority: "desc" },
    });
  }

  @Get(":promotionId")
  @RequirePermission("view", "promotion")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("promotionId") promotionId: string) {
    return this.findOwned(branch.branchId, promotionId);
  }

  @Post()
  @RequirePermission("manage", "promotion")
  @AuditEntity("Promotion")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createPromotionSchema)) body: CreatePromotionInput,
  ) {
    return this.prisma.client.promotion.create({ data: { branchId: branch.branchId, ...body } });
  }

  @Patch(":promotionId")
  @RequirePermission("manage", "promotion")
  @AuditEntity("Promotion")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("promotionId") promotionId: string,
    @Body(new ZodValidationPipe(updatePromotionSchema)) body: UpdatePromotionInput,
  ) {
    await this.findOwned(branch.branchId, promotionId);
    return this.prisma.client.promotion.update({ where: { id: promotionId }, data: body });
  }

  private async findOwned(branchId: string, promotionId: string) {
    const record = await this.prisma.client.promotion.findUnique({ where: { id: promotionId } });
    if (!record || record.branchId !== branchId) {
      throw new NotFoundException("ไม่พบโปรโมชั่นนี้");
    }
    return record;
  }
}

import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@lotus-desk/db";
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  type CreateServiceCategoryInput,
  type UpdateServiceCategoryInput,
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
 * Catalog หมวดบริการแยกต่อสาขา — CRUD ชื่อตาม ADR-063 และคง sortOrder ภายในไว้เพื่อให้
 * หมวดใหม่ต่อท้ายรายการเดิม โดยยังไม่เปิด reorder ใน UI รอบนี้
 */
@Controller("branches/:branchId/service-categories")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceCategoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "service")
  async list(@CurrentBranch() branch: BranchContext) {
    return this.prisma.forBranch(branch.branchId).serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  @Post()
  @RequirePermission("manage", "service")
  @AuditEntity("ServiceCategory")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createServiceCategorySchema)) body: CreateServiceCategoryInput,
  ) {
    const last = await this.prisma.forBranch(branch.branchId).serviceCategory.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    try {
      return await this.prisma.client.serviceCategory.create({
        data: { branchId: branch.branchId, name: body.name, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  @Patch(":serviceCategoryId")
  @RequirePermission("manage", "service")
  @AuditEntity("ServiceCategory")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("serviceCategoryId") serviceCategoryId: string,
    @Body(new ZodValidationPipe(updateServiceCategorySchema)) body: UpdateServiceCategoryInput,
  ) {
    await this.findOwned(branch.branchId, serviceCategoryId);
    try {
      return await this.prisma.client.serviceCategory.update({
        where: { id: serviceCategoryId },
        data: { name: body.name },
      });
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  @Delete(":serviceCategoryId")
  @RequirePermission("manage", "service")
  @AuditEntity("ServiceCategory")
  async remove(
    @CurrentBranch() branch: BranchContext,
    @Param("serviceCategoryId") serviceCategoryId: string,
  ) {
    await this.findOwned(branch.branchId, serviceCategoryId);
    const serviceCount = await this.prisma.forBranch(branch.branchId).service.count({
      where: { categoryId: serviceCategoryId },
    });
    if (serviceCount > 0) {
      throw new ConflictException(`ลบไม่ได้ — มีบริการ ${serviceCount} รายการที่ใช้หมวดนี้อยู่`);
    }
    try {
      await this.prisma.client.serviceCategory.delete({ where: { id: serviceCategoryId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException("ลบไม่ได้ — มีบริการที่ใช้หมวดนี้อยู่");
      }
      throw err;
    }
    return { ok: true };
  }

  private async findOwned(branchId: string, serviceCategoryId: string) {
    const category = await this.prisma.client.serviceCategory.findUnique({
      where: { id: serviceCategoryId },
    });
    if (!category || category.branchId !== branchId) {
      throw new NotFoundException("ไม่พบหมวดบริการนี้ในสาขานี้");
    }
    return category;
  }

  private rethrowConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictException("มีหมวดบริการชื่อนี้อยู่แล้วในสาขานี้");
    }
    throw err;
  }
}

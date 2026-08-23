import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createServiceSchema,
  createServiceVariantSchema,
  updateServiceSchema,
  updateServiceVariantSchema,
  type CreateServiceInput,
  type CreateServiceVariantInput,
  type UpdateServiceInput,
  type UpdateServiceVariantInput,
} from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

const SERVICE_INCLUDE = { category: true, variants: true } as const;

/**
 * บริการ (T2.3) — nested ใต้ /branches/:branchId/services เหมือนแพทเทิร์นของ RoomController (T2.2)
 * หมวดบริการ (ServiceCategory) เป็น catalog แยกต่อสาขา ยังไม่มี CRUD ของตัวเองใน Task นี้ — ดู
 * ServiceCategoryController สำหรับ endpoint อ่านอย่างเดียว
 *
 * ตัวเลือกเวลา (ServiceVariant) สร้างพร้อมบริการได้ในคำขอเดียว (ต้องมีอย่างน้อย 1 แบบ) และเพิ่ม/แก้
 * ทีหลังผ่าน /variants ต่อท้าย — ราคา/ค่ามือแก้ได้ตรง ๆ (UPDATE ปกติ ไม่ใช่ ledger เพราะยังไม่มีใบงาน
 * มาอ้างอิงราคาเดิม — T5.5 เป็นจุดที่ snapshot ราคา ณ เวลาสร้างใบงาน ทำให้ราคาเก่าไม่เปลี่ยนแม้แก้ที่นี่)
 */
@Controller("branches/:branchId/services")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "service")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("q") q?: string,
    @Query("isActive") isActiveParam?: string,
  ) {
    const isActive =
      isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    return this.prisma.forBranch(branch.branchId).service.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(trimmedQuery ? { name: { contains: trimmedQuery, mode: "insensitive" } } : {}),
      },
      include: SERVICE_INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  @Get(":serviceId")
  @RequirePermission("view", "service")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("serviceId") serviceId: string) {
    return this.findOwnedService(branch.branchId, serviceId);
  }

  @Post()
  @RequirePermission("manage", "service")
  @AuditEntity("Service")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceInput,
  ) {
    await this.assertCategoryInBranch(branch.branchId, body.categoryId);
    for (const variant of body.variants) {
      await this.assertRoomTypeInBranch(branch.branchId, variant.requiredRoomTypeId);
    }
    return this.prisma.client.service.create({
      data: {
        branchId: branch.branchId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description,
        variants: { create: body.variants },
      },
      include: SERVICE_INCLUDE,
    });
  }

  @Patch(":serviceId")
  @RequirePermission("manage", "service")
  @AuditEntity("Service")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceInput,
  ) {
    await this.findOwnedService(branch.branchId, serviceId);
    if (body.categoryId) {
      await this.assertCategoryInBranch(branch.branchId, body.categoryId);
    }
    return this.prisma.client.service.update({
      where: { id: serviceId },
      data: body,
      include: SERVICE_INCLUDE,
    });
  }

  @Post(":serviceId/variants")
  @RequirePermission("manage", "service")
  @AuditEntity("ServiceVariant")
  async addVariant(
    @CurrentBranch() branch: BranchContext,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(createServiceVariantSchema)) body: CreateServiceVariantInput,
  ) {
    await this.findOwnedService(branch.branchId, serviceId);
    await this.assertRoomTypeInBranch(branch.branchId, body.requiredRoomTypeId);
    return this.prisma.client.serviceVariant.create({ data: { ...body, serviceId } });
  }

  @Patch(":serviceId/variants/:serviceVariantId")
  @RequirePermission("manage", "service")
  @AuditEntity("ServiceVariant")
  async updateVariant(
    @CurrentBranch() branch: BranchContext,
    @Param("serviceId") serviceId: string,
    @Param("serviceVariantId") serviceVariantId: string,
    @Body(new ZodValidationPipe(updateServiceVariantSchema)) body: UpdateServiceVariantInput,
  ) {
    await this.findOwnedService(branch.branchId, serviceId);
    const existing = await this.prisma.client.serviceVariant.findUnique({
      where: { id: serviceVariantId },
    });
    if (!existing || existing.serviceId !== serviceId) {
      throw new NotFoundException("ไม่พบตัวเลือกเวลานี้");
    }
    if (body.requiredRoomTypeId) {
      await this.assertRoomTypeInBranch(branch.branchId, body.requiredRoomTypeId);
    }
    return this.prisma.client.serviceVariant.update({
      where: { id: serviceVariantId },
      data: body,
    });
  }

  private async findOwnedService(branchId: string, serviceId: string) {
    const record = await this.prisma.client.service.findUnique({
      where: { id: serviceId },
      include: SERVICE_INCLUDE,
    });
    if (!record || record.branchId !== branchId) {
      throw new NotFoundException("ไม่พบบริการนี้");
    }
    return record;
  }

  private async assertCategoryInBranch(branchId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.client.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.branchId !== branchId) {
      throw new NotFoundException("ไม่พบหมวดบริการนี้ในสาขานี้");
    }
  }

  /** กันเลือกประเภทห้องข้ามสาขา (เหมือน RoomController.assertRoomTypeInBranch ใน T2.2) */
  private async assertRoomTypeInBranch(branchId: string, roomTypeId: string): Promise<void> {
    const roomType = await this.prisma.client.roomType.findUnique({ where: { id: roomTypeId } });
    if (!roomType || roomType.branchId !== branchId) {
      throw new NotFoundException("ไม่พบประเภทห้องนี้ในสาขานี้");
    }
  }
}

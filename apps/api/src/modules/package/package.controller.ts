import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createPackageSchema,
  updatePackageSchema,
  type CreatePackageInput,
  type UpdatePackageInput,
} from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

const PACKAGE_INCLUDE = { serviceVariant: { include: { service: true } } } as const;

/**
 * คอร์ส/แพ็กเกจ (T5.1) — catalog เท่านั้น (ราคา, ประเภท, จำนวนครั้ง/มูลค่า, อายุการใช้งาน) ยังไม่ใช่
 * ยอดคงเหลือของลูกค้าคนใด (นั่นคือ MemberPackage + ledger ใน T5.2 ตาม CLAUDE.md ข้อ 7)
 *
 * type/sessionCount/valueSatang/serviceVariantId แก้ไม่ได้หลังสร้าง (ดู docs/decisions.md ADR-025) —
 * endpoint แก้ไขจึงรับเฉพาะ name/priceSatang/validDays/isActive เท่านั้น (updatePackageSchema บังคับ
 * รูปร่างนี้อยู่แล้วที่ชั้น contracts)
 */
@Controller("branches/:branchId/packages")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PackageController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "package")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("q") q?: string,
    @Query("isActive") isActiveParam?: string,
  ) {
    const isActive = isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    return this.prisma.forBranch(branch.branchId).package.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(trimmedQuery ? { name: { contains: trimmedQuery, mode: "insensitive" } } : {}),
      },
      include: PACKAGE_INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  @Get(":packageId")
  @RequirePermission("view", "package")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("packageId") packageId: string) {
    return this.findOwnedPackage(branch.branchId, packageId);
  }

  @Post()
  @RequirePermission("manage", "package")
  @AuditEntity("Package")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createPackageSchema)) body: CreatePackageInput,
  ) {
    if ("serviceVariantId" in body) {
      await this.assertServiceVariantInBranch(branch.branchId, body.serviceVariantId);
    }
    return this.prisma.client.package.create({
      data: { branchId: branch.branchId, ...body },
      include: PACKAGE_INCLUDE,
    });
  }

  @Patch(":packageId")
  @RequirePermission("manage", "package")
  @AuditEntity("Package")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("packageId") packageId: string,
    @Body(new ZodValidationPipe(updatePackageSchema)) body: UpdatePackageInput,
  ) {
    await this.findOwnedPackage(branch.branchId, packageId);
    return this.prisma.client.package.update({
      where: { id: packageId },
      data: body,
      include: PACKAGE_INCLUDE,
    });
  }

  private async findOwnedPackage(branchId: string, packageId: string) {
    const record = await this.prisma.client.package.findUnique({
      where: { id: packageId },
      include: PACKAGE_INCLUDE,
    });
    if (!record || record.branchId !== branchId) {
      throw new NotFoundException("ไม่พบคอร์ส/แพ็กเกจนี้");
    }
    return record;
  }

  /** กันเลือกบริการข้ามสาขา (เหมือน ServiceController.assertRoomTypeInBranch ใน T2.3) */
  private async assertServiceVariantInBranch(branchId: string, serviceVariantId: string): Promise<void> {
    const variant = await this.prisma.client.serviceVariant.findUnique({
      where: { id: serviceVariantId },
      include: { service: true },
    });
    if (!variant || variant.service.branchId !== branchId) {
      throw new NotFoundException("ไม่พบบริการนี้ในสาขานี้");
    }
  }
}

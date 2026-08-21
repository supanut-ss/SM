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
import { createStaffSchema, updateStaffSchema, type CreateStaffInput, type UpdateStaffInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * พนักงานให้บริการ (T2.1) — nested ใต้ /branches/:branchId/staff เหมือนแพทเทิร์นของ
 * BranchController (T1.4) route param ต้องชื่อ :branchId เสมอให้ PermissionGuard resolve ได้
 */
@Controller("branches/:branchId/staff")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "staff")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("q") q?: string,
    @Query("isActive") isActiveParam?: string,
  ) {
    // ค่าเริ่มต้น: โชว์เฉพาะที่ยังทำงานอยู่ — ?isActive=false โชว์เฉพาะปิดใช้งาน, ?isActive=all โชว์ทั้งหมด
    const isActive =
      isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    return this.prisma.forBranch(branch.branchId).staffProfile.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(trimmedQuery
          ? {
              OR: [
                { name: { contains: trimmedQuery, mode: "insensitive" } },
                { phone: { contains: trimmedQuery, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  @Get(":staffId")
  @RequirePermission("view", "staff")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("staffId") staffId: string) {
    const record = await this.prisma.client.staffProfile.findUnique({ where: { id: staffId } });
    if (!record || record.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้");
    }
    return record;
  }

  @Post()
  @RequirePermission("manage", "staff")
  @AuditEntity("Staff")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createStaffSchema)) body: CreateStaffInput,
  ) {
    return this.prisma.client.staffProfile.create({
      data: { ...body, branchId: branch.branchId },
    });
  }

  @Patch(":staffId")
  @RequirePermission("manage", "staff")
  @AuditEntity("Staff")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("staffId") staffId: string,
    @Body(new ZodValidationPipe(updateStaffSchema)) body: UpdateStaffInput,
  ) {
    const existing = await this.prisma.client.staffProfile.findUnique({ where: { id: staffId } });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้");
    }
    return this.prisma.client.staffProfile.update({ where: { id: staffId }, data: body });
  }
}

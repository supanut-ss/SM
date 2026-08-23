import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  createShiftTemplateSchema,
  updateShiftTemplateSchema,
  type CreateShiftTemplateInput,
  type UpdateShiftTemplateInput,
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
 * แม่แบบกะ (T2.4) — nested ใต้ /branches/:branchId/shift-templates เหมือนแพทเทิร์นของ RoomController
 * ไม่มี permission resource แยกของตัวเอง — ใช้ "staff" ร่วมกับ StaffController เพราะ PLAN.md ไม่ได้ระบุ
 * หน้า/permission resource แยกสำหรับกะ (ดู docs/decisions.md) กะเป็นส่วนหนึ่งของการจัดการพนักงาน
 */
@Controller("branches/:branchId/shift-templates")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShiftTemplateController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "staff")
  async list(@CurrentBranch() branch: BranchContext, @Query("isActive") isActiveParam?: string) {
    const isActive =
      isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;

    return this.prisma.forBranch(branch.branchId).shiftTemplate.findMany({
      where: isActive === undefined ? {} : { isActive },
      orderBy: { startMin: "asc" },
    });
  }

  @Get(":shiftTemplateId")
  @RequirePermission("view", "staff")
  async getOne(
    @CurrentBranch() branch: BranchContext,
    @Param("shiftTemplateId") shiftTemplateId: string,
  ) {
    return this.findOwned(branch.branchId, shiftTemplateId);
  }

  @Post()
  @RequirePermission("manage", "staff")
  @AuditEntity("ShiftTemplate")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createShiftTemplateSchema)) body: CreateShiftTemplateInput,
  ) {
    return this.prisma.client.shiftTemplate.create({
      data: { ...body, branchId: branch.branchId },
    });
  }

  @Patch(":shiftTemplateId")
  @RequirePermission("manage", "staff")
  @AuditEntity("ShiftTemplate")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("shiftTemplateId") shiftTemplateId: string,
    @Body(new ZodValidationPipe(updateShiftTemplateSchema)) body: UpdateShiftTemplateInput,
  ) {
    const existing = await this.findOwned(branch.branchId, shiftTemplateId);
    const nextStartMin = body.startMin ?? existing.startMin;
    const nextEndMin = body.endMin ?? existing.endMin;
    if (nextEndMin <= nextStartMin) {
      throw new UnprocessableEntityException(
        "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม (ยังไม่รองรับกะข้ามเที่ยงคืน)",
      );
    }
    return this.prisma.client.shiftTemplate.update({
      where: { id: shiftTemplateId },
      data: body,
    });
  }

  private async findOwned(branchId: string, shiftTemplateId: string) {
    const record = await this.prisma.client.shiftTemplate.findUnique({
      where: { id: shiftTemplateId },
    });
    if (!record || record.branchId !== branchId) {
      throw new NotFoundException("ไม่พบแม่แบบกะนี้");
    }
    return record;
  }
}

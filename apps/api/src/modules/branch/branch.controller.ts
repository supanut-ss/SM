import { Body, Controller, Get, NotFoundException, Patch, UseGuards } from "@nestjs/common";
import { updateBranchSchema, type UpdateBranchInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * ตัวอย่างการใช้ RBAC จริง (T1.4) — endpoint นี้คือที่มาของ:
 * "ผู้จัดการสาขา A เรียกข้อมูลสาขา B ต้องได้ 403 ทุก endpoint"
 * route param ต้องชื่อ :branchId ให้ตรงกับที่ PermissionGuard คาดหวัง
 */
@Controller("branches")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BranchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":branchId")
  @RequirePermission("view", "branch")
  async getBranch(@CurrentBranch() branch: BranchContext) {
    // PermissionGuard ยืนยันแล้วว่า user สังกัดสาขานี้จริง — ปลอดภัยที่จะดึงข้อมูลตรง ๆ ด้วย id
    const record = await this.prisma.client.branch.findUnique({ where: { id: branch.branchId } });
    if (!record) {
      throw new NotFoundException("ไม่พบสาขานี้");
    }
    return record;
  }

  @Get(":branchId/devices")
  @RequirePermission("view", "branch")
  async listDevices(@CurrentBranch() branch: BranchContext) {
    // ใช้ forBranch() แทน prisma.client ตรง ๆ — กันพลาดลืมกรอง branchId แม้ query จะยาวขึ้นในอนาคต
    return this.prisma.forBranch(branch.branchId).device.findMany({ orderBy: { label: "asc" } });
  }

  @Patch(":branchId")
  @RequirePermission("manage", "branch")
  @AuditEntity("Branch") // AuditInterceptor (global) จับคู่ :branchId กับ entity นี้อัตโนมัติ (ดู T1.5)
  async updateBranch(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchInput,
  ) {
    return this.prisma.client.branch.update({ where: { id: branch.branchId }, data: body });
  }
}

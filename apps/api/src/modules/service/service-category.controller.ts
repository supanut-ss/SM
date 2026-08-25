import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * อ่านอย่างเดียว — ใช้เติม dropdown ตอนสร้าง/แก้ไขบริการ (T2.3) ยังไม่มี create/update/delete
 * เพราะตกลงกันว่าแค่ seed ค่าเริ่มต้นพอ ไม่ต้องมีหน้าจัดการหมวดบริการแยก (เหมือน RoomType ใน T2.2,
 * ดู docs/decisions.md ADR-010/ADR-012)
 */
@Controller("branches/:branchId/service-categories")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceCategoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "service")
  async list(@CurrentBranch() branch: BranchContext) {
    return this.prisma.forBranch(branch.branchId).serviceCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }
}

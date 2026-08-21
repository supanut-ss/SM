import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * อ่านอย่างเดียว — ใช้เติม dropdown ตอนสร้าง/แก้ไขห้อง (T2.2) ยังไม่มี create/update/delete
 * เพราะ T2.2 ตกลงกันว่าแค่ seed ค่าเริ่มต้นพอ ไม่ต้องมีหน้าจัดการประเภทห้องแยก (ดู docs/decisions.md)
 */
@Controller("branches/:branchId/room-types")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoomTypeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "room")
  async list(@CurrentBranch() branch: BranchContext) {
    return this.prisma.forBranch(branch.branchId).roomType.findMany({
      orderBy: { name: "asc" },
    });
  }
}

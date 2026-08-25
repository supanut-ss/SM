import { Body, Controller, Get, NotFoundException, Post, Query, UseGuards } from "@nestjs/common";
import { joinStaffQueueSchema, type JoinStaffQueueInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { joinQueue } from "./staff-queue";
import { toBangkokDateOnly } from "./bangkok-date";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * คิวหมุน (T4.4) — "เข้าคิว" ตอนเริ่มวัน (เรียงตามเวลาที่กดจริง ตรงกับ docs/DOMAIN.md ข้อ 1 "เรียงตาม
 * เวลามาถึง" จนกว่า T6.1 จะมี clock-in จริงมาเรียกแทน) ส่วนการย้ายคิวตอนจบงาน/ยกเลิกกะทันหันอยู่ที่
 * AppointmentItemController.updateStatus (ดู docs/decisions.md ADR-022)
 */
@Controller("branches/:branchId/staff-queue")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffQueueController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "booking")
  async list(@CurrentBranch() branch: BranchContext, @Query("date") dateParam?: string) {
    const date = dateParam ? toBangkokDateOnly(new Date(dateParam)) : toBangkokDateOnly(new Date());
    return this.prisma.client.staffQueueEntry.findMany({
      where: { branchId: branch.branchId, date },
      include: { staff: true },
      orderBy: { position: "asc" },
    });
  }

  @Post("join")
  @RequirePermission("manage", "booking")
  @AuditEntity("StaffQueueEntry")
  async join(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(joinStaffQueueSchema)) body: JoinStaffQueueInput,
  ) {
    const staff = await this.prisma.client.staffProfile.findUnique({ where: { id: body.staffId } });
    if (!staff || staff.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้ในสาขานี้");
    }

    const date = body.date ? toBangkokDateOnly(body.date) : toBangkokDateOnly(new Date());
    const existing = await this.prisma.client.staffQueueEntry.findMany({
      where: { branchId: branch.branchId, date },
    });

    const already = existing.find((e) => e.staffId === body.staffId);
    if (already) return already;

    const next = joinQueue(
      existing.map((e) => ({ staffId: e.staffId, position: e.position })),
      body.staffId,
    );
    const added = next.find((e) => e.staffId === body.staffId)!;
    return this.prisma.client.staffQueueEntry.create({
      data: { branchId: branch.branchId, staffId: body.staffId, date, position: added.position },
    });
  }
}

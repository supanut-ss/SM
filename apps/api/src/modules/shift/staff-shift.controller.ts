import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { createStaffShiftSchema, type CreateStaffShiftInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * การจ่ายกะจริงต่อวัน (T2.4) — nested ใต้ /branches/:branchId/staff-shifts ใช้ permission "staff"
 * ร่วมกับ StaffController (ดู ShiftTemplateController) เกณฑ์ผ่านหลักของ T2.4 คือ "กะซ้อนกันต้องถูกปฏิเสธ"
 * เช็คที่ create() ก่อน insert เสมอ — เป็นการเช็คระดับ application ไม่ใช่ DB constraint (EXCLUDE USING gist
 * ตาม T4.2 ยังไม่จำเป็นตอนนี้เพราะการชนกันของกะไม่กระทบเงินโดยตรงเท่าการจองซ้อนที่ต้องกันเงินหาย)
 */
@Controller("branches/:branchId/staff-shifts")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffShiftController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "staff")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(now.getDate() - 7);
    const defaultTo = new Date(now);
    defaultTo.setDate(now.getDate() + 30);

    return this.prisma.forBranch(branch.branchId).staffShift.findMany({
      where: { date: { gte: parseDateParam(from, defaultFrom), lte: parseDateParam(to, defaultTo) } },
      include: { staff: true, shiftTemplate: true },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    });
  }

  @Post()
  @RequirePermission("manage", "staff")
  @AuditEntity("StaffShift")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createStaffShiftSchema)) body: CreateStaffShiftInput,
  ) {
    const staff = await this.prisma.client.staffProfile.findUnique({
      where: { id: body.staffId },
    });
    if (!staff || staff.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้ในสาขานี้");
    }
    const template = await this.prisma.client.shiftTemplate.findUnique({
      where: { id: body.shiftTemplateId },
    });
    if (!template || template.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบแม่แบบกะนี้ในสาขานี้");
    }

    // เกณฑ์ผ่าน T2.4: กะซ้อนกันต้องถูกปฏิเสธ — เช็คทุกกะที่พนักงานคนนี้มีอยู่แล้วในวันเดียวกัน
    const sameDayShifts = await this.prisma.client.staffShift.findMany({
      where: { staffId: body.staffId, date: body.date },
    });
    const overlapping = sameDayShifts.find(
      (existing) => existing.startMin < template.endMin && template.startMin < existing.endMin,
    );
    if (overlapping) {
      throw new UnprocessableEntityException(
        `พนักงานคนนี้มีกะซ้อนกันในวันนี้แล้ว (${formatMin(overlapping.startMin)}-${formatMin(overlapping.endMin)})`,
      );
    }

    return this.prisma.client.staffShift.create({
      data: {
        branchId: branch.branchId,
        staffId: body.staffId,
        shiftTemplateId: body.shiftTemplateId,
        date: body.date,
        startMin: template.startMin,
        endMin: template.endMin,
      },
      include: { staff: true, shiftTemplate: true },
    });
  }

  @Delete(":staffShiftId")
  @RequirePermission("manage", "staff")
  @AuditEntity("StaffShift")
  async remove(@CurrentBranch() branch: BranchContext, @Param("staffShiftId") staffShiftId: string) {
    const existing = await this.prisma.client.staffShift.findUnique({
      where: { id: staffShiftId },
    });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบกะนี้");
    }
    return this.prisma.client.staffShift.delete({ where: { id: staffShiftId } });
  }
}

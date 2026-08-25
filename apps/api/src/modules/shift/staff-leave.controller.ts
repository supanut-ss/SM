import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { createStaffLeaveSchema, type CreateStaffLeaveInput } from "@lotus-desk/contracts";
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

/** ไล่วันที่ระหว่าง from ถึง to (รวมทั้งสองปลาย) ทีละวัน — ใช้ขยายช่วงลาเป็น 1 แถวต่อวัน */
function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/**
 * วันลาของพนักงาน (T2.4) — nested ใต้ /branches/:branchId/staff-leaves ใช้ permission "staff"
 * ร่วมกับ StaffController เหมือน ShiftTemplateController/StaffShiftController สร้างเป็นช่วงวันที่ได้
 * ในคำขอเดียว (API ขยายเป็น 1 แถวต่อวันเอง) — 1 คนลาได้แค่ประเภทเดียวต่อวัน (@@unique staffId+date)
 */
@Controller("branches/:branchId/staff-leaves")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffLeaveController {
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

    return this.prisma.forBranch(branch.branchId).staffLeave.findMany({
      where: { date: { gte: parseDateParam(from, defaultFrom), lte: parseDateParam(to, defaultTo) } },
      include: { staff: true },
      orderBy: [{ date: "asc" }],
    });
  }

  @Post()
  @RequirePermission("manage", "staff")
  @AuditEntity("StaffLeave")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createStaffLeaveSchema)) body: CreateStaffLeaveInput,
  ) {
    const staff = await this.prisma.client.staffProfile.findUnique({
      where: { id: body.staffId },
    });
    if (!staff || staff.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้ในสาขานี้");
    }

    const dates = eachDate(body.dateFrom, body.dateTo);
    const existing = await this.prisma.client.staffLeave.findMany({
      where: { staffId: body.staffId, date: { in: dates } },
    });
    if (existing.length > 0) {
      throw new ConflictException("พนักงานคนนี้มีวันลาบันทึกไว้แล้วในบางวันของช่วงที่เลือก");
    }

    return this.prisma.client.staffLeave.createManyAndReturn({
      data: dates.map((date) => ({
        branchId: branch.branchId,
        staffId: body.staffId,
        date,
        type: body.type,
        note: body.note,
      })),
    });
  }

  @Delete(":staffLeaveId")
  @RequirePermission("manage", "staff")
  @AuditEntity("StaffLeave")
  async remove(@CurrentBranch() branch: BranchContext, @Param("staffLeaveId") staffLeaveId: string) {
    const existing = await this.prisma.client.staffLeave.findUnique({
      where: { id: staffLeaveId },
    });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบวันลานี้");
    }
    return this.prisma.client.staffLeave.delete({ where: { id: staffLeaveId } });
  }
}

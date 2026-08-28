import {
  Body,
  ConflictException,
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
import * as argon2 from "argon2";
import {
  createStaffSchema,
  setStaffPinSchema,
  updateStaffSchema,
  type CreateStaffInput,
  type SetStaffPinInput,
  type UpdateStaffInput,
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
    if (body.userId) {
      await this.assertUserLinkable(branch.branchId, body.userId);
    }
    try {
      return await this.prisma.client.staffProfile.create({
        data: { ...body, branchId: branch.branchId },
      });
    } catch (err) {
      throw this.translateUserLinkError(err);
    }
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
    if (body.userId) {
      await this.assertUserLinkable(branch.branchId, body.userId);
    }
    try {
      return await this.prisma.client.staffProfile.update({ where: { id: staffId }, data: body });
    } catch (err) {
      throw this.translateUserLinkError(err);
    }
  }

  /** ผูก StaffProfile กับบัญชีผู้ใช้ (T6.1) — บัญชีต้องมีอยู่จริงและสังกัดสาขาเดียวกันเท่านั้น กันการผูกข้ามสาขา */
  private async assertUserLinkable(branchId: string, userId: string): Promise<void> {
    const userBranch = await this.prisma.client.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });
    if (!userBranch) {
      throw new UnprocessableEntityException("บัญชีผู้ใช้นี้ไม่พบ หรือไม่ได้สังกัดสาขานี้");
    }
  }

  /** unique constraint บน StaffProfile.userId ชนตอนบัญชีถูกผูกกับพนักงานคนอื่นไปแล้ว — แปลเป็นข้อความอ่านรู้เรื่อง */
  private translateUserLinkError(err: unknown): unknown {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return new ConflictException("บัญชีผู้ใช้นี้ถูกผูกกับพนักงานคนอื่นไปแล้ว");
    }
    return err;
  }

  /**
   * ตั้ง/เปลี่ยน PIN ลงเวลาเข้า-ออกงาน (T6.1) — คนละระบบจาก User.pinHash (ดู comment บน
   * StaffProfile.pinHash ใน schema.prisma) รีเซ็ตตัวนับผิด/ล็อกทุกครั้งที่ตั้ง PIN ใหม่
   * ไม่คืน hash หรือ PIN ดิบกลับไปเด็ดขาด
   */
  @Post(":staffId/pin")
  @RequirePermission("manage", "staff")
  @AuditEntity("StaffProfile")
  async setPin(
    @CurrentBranch() branch: BranchContext,
    @Param("staffId") staffId: string,
    @Body(new ZodValidationPipe(setStaffPinSchema)) body: SetStaffPinInput,
  ): Promise<{ id: string; ok: true }> {
    const existing = await this.prisma.client.staffProfile.findUnique({ where: { id: staffId } });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้");
    }
    const pinHash = await argon2.hash(body.pin);
    await this.prisma.client.staffProfile.update({
      where: { id: staffId },
      data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });
    // `id` ที่ระดับบน (นอกจาก `ok`) — route param ชื่อ :staffId ไม่ตรงกับ paramName ที่ AuditInterceptor
    // คำนวณจาก @AuditEntity("StaffProfile") (จะได้ "staffProfileId") จึง fallback ไปอ่าน `after.id` แทน
    return { id: existing.id, ok: true };
  }
}

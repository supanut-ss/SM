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
  UseGuards,
} from "@nestjs/common";
import {
  createMemberSchema,
  updateMemberSchema,
  type CreateMemberInput,
  type UpdateMemberInput,
} from "@lotus-desk/contracts";
import { Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

const CODE_GENERATION_ATTEMPTS = 5;

/**
 * สมาชิก (T3.1) — nested ใต้ /branches/:branchId/members เหมือนแพทเทิร์นของ StaffController
 * ค้นหาแบบพิมพ์ไม่ครบก็เจอผ่าน ILIKE (Prisma "contains" + "insensitive") บน name/phone —
 * เร่งความเร็วด้วย GIN trigram index ที่สร้างใน migration (ดู docs/decisions.md ADR-014)
 *
 * เตือนซ้ำตอนสร้างถ้าเบอร์ตรงกัน: ตอบ 409 พร้อมรายชื่อสมาชิกที่ซ้ำ ให้ฝั่งเว็บถามยืนยันแล้วส่งซ้ำพร้อม
 * confirmDuplicate:true เพื่อสร้างต่อ (ไม่ใช่ห้ามซ้ำเด็ดขาด — ตัดสินใจแล้วตอนเริ่ม Task นี้)
 */
@Controller("branches/:branchId/members")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MemberController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "member")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("q") q?: string,
    @Query("isActive") isActiveParam?: string,
  ) {
    const isActive =
      isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    return this.prisma.forBranch(branch.branchId).member.findMany({
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

  @Get(":memberId")
  @RequirePermission("view", "member")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("memberId") memberId: string) {
    const record = await this.prisma.client.member.findUnique({ where: { id: memberId } });
    if (!record || record.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบสมาชิกนี้");
    }
    return record;
  }

  @Post()
  @RequirePermission("manage", "member")
  @AuditEntity("Member")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createMemberSchema)) body: CreateMemberInput,
  ) {
    if (!body.confirmDuplicate) {
      const duplicates = await this.prisma.client.member.findMany({
        where: { branchId: branch.branchId, phone: body.phone },
        select: { id: true, code: true, name: true },
      });
      if (duplicates.length > 0) {
        throw new ConflictException({
          message: `พบสมาชิกที่ใช้เบอร์นี้อยู่แล้ว: ${duplicates
            .map((d) => `${d.name} (${d.code})`)
            .join(", ")} — ยืนยันเพื่อสร้างสมาชิกใหม่ต่อไป`,
          duplicates,
        });
      }
    }

    return this.createWithGeneratedCode(branch.branchId, {
      name: body.name,
      phone: body.phone,
      note: body.note,
    });
  }

  @Patch(":memberId")
  @RequirePermission("manage", "member")
  @AuditEntity("Member")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("memberId") memberId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) body: UpdateMemberInput,
  ) {
    const existing = await this.prisma.client.member.findUnique({ where: { id: memberId } });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบสมาชิกนี้");
    }
    return this.prisma.client.member.update({ where: { id: memberId }, data: body });
  }

  /**
   * รหัสสมาชิกรันอัตโนมัติ "M" + เลข 6 หลัก เรียงตามลำดับต่อสาขา — นับจำนวนสมาชิกปัจจุบัน + 1 แล้วลองสร้าง
   * ถ้าชนกับรหัสที่มีอยู่แล้ว (แข่งกันสร้างพร้อมกัน) ลองเลขถัดไปซ้ำได้สูงสุด 5 ครั้งก่อนล้มเลิก
   */
  private async createWithGeneratedCode(
    branchId: string,
    data: { name: string; phone: string; note: string | undefined },
  ) {
    for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS; attempt++) {
      const count = await this.prisma.client.member.count({ where: { branchId } });
      const code = `M${(count + 1 + attempt).toString().padStart(6, "0")}`;
      try {
        return await this.prisma.client.member.create({ data: { ...data, branchId, code } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException("ไม่สามารถสร้างรหัสสมาชิกใหม่ได้ กรุณาลองใหม่อีกครั้ง");
  }
}

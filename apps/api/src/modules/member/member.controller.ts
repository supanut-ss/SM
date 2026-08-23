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
import {
  createMemberSchema,
  mergeMemberSchema,
  updateMemberSchema,
  type CreateMemberInput,
  type MergeMemberInput,
  type UpdateMemberInput,
} from "@lotus-desk/contracts";
import { AuditAction, Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import type { ConsentStatus, ConsentType } from "@lotus-desk/db";

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
    @Query("marketingConsent") marketingConsentParam?: string,
  ) {
    const isActive =
      isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    let consentFilter: { in: string[] } | { notIn: string[] } | undefined;
    if (marketingConsentParam === "true" || marketingConsentParam === "false") {
      const granted = await this.getMemberIdsWithLatestConsent(branch.branchId, "MARKETING", "GRANTED");
      consentFilter = marketingConsentParam === "true" ? { in: [...granted] } : { notIn: [...granted] };
    }

    return this.prisma.forBranch(branch.branchId).member.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(consentFilter ? { id: consentFilter } : {}),
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
   * รวมสมาชิกซ้ำ (T3.4) — :memberId ในเส้นทางคือ "รายการรอง" (ตัวที่จะถูกปิดใช้งาน) ให้ AuditInterceptor
   * จับ before/after ของสมาชิกรองอัตโนมัติผ่าน @AuditEntity("Member") ปกติ ส่วนการย้าย MemberConsent
   * (คนละ entity ที่ interceptor ตัวเดียวจับไม่ครบ) เขียน audit log เพิ่มเองต่อแถวภายใน transaction เดียวกัน
   * ไม่ใช่การเลี่ยง AuditInterceptor (ยังผ่านปกติสำหรับ Member) แค่เสริมให้ reconstruct ครบ (เกณฑ์ผ่าน
   * T3.4: "ย้อนกลับได้ผ่าน audit log") — ยังไม่มี MemberPackage/แต้มในระบบตอนนี้ (รอ T5.2/loyalty ในอนาคต)
   * จึงย้ายแค่ MemberConsent เท่าที่มีจริง ดู docs/decisions.md ADR-018
   */
  @Post(":memberId/merge")
  @RequirePermission("manage", "member")
  @AuditEntity("Member")
  async merge(
    @CurrentBranch() branch: BranchContext,
    @Param("memberId") memberId: string,
    @Body(new ZodValidationPipe(mergeMemberSchema)) body: MergeMemberInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (body.primaryMemberId === memberId) {
      throw new UnprocessableEntityException("ไม่สามารถรวมสมาชิกเข้ากับตัวเองได้");
    }

    const secondary = await this.prisma.client.member.findUnique({ where: { id: memberId } });
    if (!secondary || secondary.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบสมาชิกนี้");
    }
    if (secondary.mergedIntoId) {
      throw new ConflictException("สมาชิกนี้ถูกรวมเข้ากับสมาชิกอื่นไปแล้ว");
    }

    const primary = await this.prisma.client.member.findUnique({
      where: { id: body.primaryMemberId },
    });
    if (!primary || primary.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบสมาชิกหลักที่จะรวมเข้า");
    }
    if (primary.mergedIntoId) {
      throw new UnprocessableEntityException(
        "ไม่สามารถรวมเข้ากับสมาชิกที่ถูกรวมไปแล้วได้ — เลือกสมาชิกหลักตัวจริง",
      );
    }

    return this.prisma.client.$transaction(async (tx) => {
      const consents = await tx.memberConsent.findMany({ where: { memberId } });
      for (const consent of consents) {
        await tx.memberConsent.update({ where: { id: consent.id }, data: { memberId: primary.id } });
        await tx.auditLog.create({
          data: {
            branchId: branch.branchId,
            actorId: user.sub,
            action: AuditAction.UPDATE,
            entity: "MemberConsent",
            entityId: consent.id,
            before: { memberId },
            after: { memberId: primary.id },
          },
        });
      }

      return tx.member.update({
        where: { id: memberId },
        data: { isActive: false, mergedIntoId: primary.id },
      });
    });
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

  /**
   * สถานะความยินยอมปัจจุบันของสมาชิก = แถวล่าสุด (DISTINCT ON ... ORDER BY createdAt DESC) ต่อคนต่อประเภท
   * เพราะ MemberConsent เป็น append-only (ดู docs/decisions.md ADR-016) ไม่มี "isCurrent" flag ให้ query ตรง ๆ
   * ใช้เฉพาะกรอง "รายชื่อส่งโปรฯ" (เกณฑ์ผ่าน T3.3: ถอนความยินยอมรับข่าวสารแล้วต้องหลุดจากรายชื่อทันที)
   */
  private async getMemberIdsWithLatestConsent(
    branchId: string,
    type: ConsentType,
    status: ConsentStatus,
  ): Promise<Set<string>> {
    const rows = await this.prisma.client.$queryRaw<Array<{ memberId: string; status: ConsentStatus }>>`
      SELECT DISTINCT ON ("memberId") "memberId", "status"
      FROM "member_consents"
      WHERE "branchId" = ${branchId} AND "type" = ${type}::"ConsentType"
      ORDER BY "memberId", "createdAt" DESC
    `;
    return new Set(rows.filter((r) => r.status === status).map((r) => r.memberId));
  }
}

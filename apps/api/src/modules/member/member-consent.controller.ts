import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { createMemberConsentSchema, type CreateMemberConsentInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * ประวัติความยินยอม PDPA ของสมาชิก (T3.3) — nested ใต้ /branches/:branchId/members/:memberId/consents
 * append-only เสมอ (ดู docs/decisions.md ADR-016) — ไม่มี PATCH/DELETE เพราะ "ถอนความยินยอม" คือ INSERT
 * แถวใหม่ที่ status = WITHDRAWN ไม่ใช่แก้แถวเดิม — สถานะปัจจุบันของสมาชิกต่อประเภทคือแถวล่าสุดเสมอ
 */
@Controller("branches/:branchId/members/:memberId/consents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MemberConsentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "member")
  async list(@CurrentBranch() branch: BranchContext, @Param("memberId") memberId: string) {
    await this.assertMemberInBranch(branch.branchId, memberId);
    return this.prisma.client.memberConsent.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  @RequirePermission("manage", "member")
  @AuditEntity("MemberConsent")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Param("memberId") memberId: string,
    @Body(new ZodValidationPipe(createMemberConsentSchema)) body: CreateMemberConsentInput,
  ) {
    await this.assertMemberInBranch(branch.branchId, memberId);
    return this.prisma.client.memberConsent.create({
      data: { ...body, branchId: branch.branchId, memberId },
    });
  }

  private async assertMemberInBranch(branchId: string, memberId: string): Promise<void> {
    const member = await this.prisma.client.member.findUnique({ where: { id: memberId } });
    if (!member || member.branchId !== branchId) {
      throw new NotFoundException("ไม่พบสมาชิกนี้");
    }
  }
}

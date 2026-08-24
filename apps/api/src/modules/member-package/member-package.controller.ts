import { Controller, Get, NotFoundException, Param, Post, Body, UnprocessableEntityException, UseGuards } from "@nestjs/common";
import { purchaseMemberPackageSchema, type PurchaseMemberPackageInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

const MEMBER_PACKAGE_INCLUDE = { serviceVariant: { include: { service: true } } } as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * คอร์สที่สมาชิกถือครอง (T5.2) — nested ใต้ /branches/:branchId/members/:memberId/packages เหมือน
 * แพทเทิร์นของ MemberConsentController (T3.3) การกระทำหลังซื้อ (ตัด/คืน/แช่แข็ง/โอน/ปิดหมดอายุ) อยู่ที่
 * MemberPackageActionController แยกต่างหาก (nested ใต้ /branches/:branchId/member-packages/:id แทน
 * เพราะไม่ต้องรู้ memberId ซ้ำอีกหลังจากมี memberPackageId แล้ว)
 */
@Controller("branches/:branchId/members/:memberId/packages")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MemberPackageController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "package")
  async list(@CurrentBranch() branch: BranchContext, @Param("memberId") memberId: string) {
    await this.assertMemberInBranch(branch.branchId, memberId);

    const records = await this.prisma.client.memberPackage.findMany({
      where: { memberId },
      include: MEMBER_PACKAGE_INCLUDE,
      orderBy: { purchasedAt: "desc" },
    });
    if (records.length === 0) return [];

    const sums = await this.prisma.client.memberPackageLedgerEntry.groupBy({
      by: ["memberPackageId"],
      where: { memberPackageId: { in: records.map((r) => r.id) } },
      _sum: { delta: true },
    });
    const balanceByPackageId = new Map(sums.map((s) => [s.memberPackageId, s._sum.delta ?? 0]));

    return records.map((r) => ({ ...r, balance: balanceByPackageId.get(r.id) ?? 0 }));
  }

  @Post()
  @RequirePermission("manage", "package")
  @AuditEntity("MemberPackage")
  async purchase(
    @CurrentBranch() branch: BranchContext,
    @Param("memberId") memberId: string,
    @Body(new ZodValidationPipe(purchaseMemberPackageSchema)) body: PurchaseMemberPackageInput,
  ) {
    await this.assertMemberInBranch(branch.branchId, memberId);

    const pkg = await this.prisma.client.package.findUnique({ where: { id: body.packageId } });
    if (!pkg || pkg.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบคอร์ส/แพ็กเกจนี้ในสาขานี้");
    }
    if (!pkg.isActive) {
      throw new UnprocessableEntityException("คอร์ส/แพ็กเกจนี้ปิดขายแล้ว ซื้อไม่ได้");
    }

    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt.getTime() + pkg.validDays * MS_PER_DAY);
    const initialDelta =
      pkg.type === "SESSION_COUNT" ? (pkg.sessionCount ?? 0) : pkg.type === "VALUE" ? (pkg.valueSatang ?? 0) : 0;

    const created = await this.prisma.client.$transaction(async (tx) => {
      const memberPackage = await tx.memberPackage.create({
        data: {
          branchId: branch.branchId,
          memberId,
          packageId: pkg.id,
          name: pkg.name,
          type: pkg.type,
          priceSatang: pkg.priceSatang,
          sessionCount: pkg.sessionCount,
          valueSatang: pkg.valueSatang,
          serviceVariantId: pkg.serviceVariantId,
          purchasedAt,
          validDays: pkg.validDays,
          expiresAt,
        },
        include: MEMBER_PACKAGE_INCLUDE,
      });
      await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId: memberPackage.id,
          kind: "PURCHASE",
          delta: initialDelta,
        },
      });
      return memberPackage;
    });

    return { ...created, balance: initialDelta };
  }

  private async assertMemberInBranch(branchId: string, memberId: string): Promise<void> {
    const member = await this.prisma.client.member.findUnique({ where: { id: memberId } });
    if (!member || member.branchId !== branchId) {
      throw new NotFoundException("ไม่พบสมาชิกนี้");
    }
  }
}

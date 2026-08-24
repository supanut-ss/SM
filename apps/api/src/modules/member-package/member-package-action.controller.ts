import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  expireMemberPackageSchema,
  freezeMemberPackageSchema,
  refundMemberPackageSchema,
  transferMemberPackageSchema,
  useMemberPackageSchema,
  type ExpireMemberPackageInput,
  type FreezeMemberPackageInput,
  type RefundMemberPackageInput,
  type TransferMemberPackageInput,
  type UseMemberPackageInput,
} from "@lotus-desk/contracts";
import {
  validateExpire,
  validateFreeze,
  validateRefund,
  validateTransfer,
  validateUse,
} from "@lotus-desk/core";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { MemberPackageService } from "./member-package.service";
import type { BranchContext } from "../rbac/permission.guard";
import type { MemberPackage } from "@lotus-desk/db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * การกระทำบนคอร์สที่สมาชิกถือครองไปแล้ว (T5.2) — ตัด/คืน/แช่แข็ง/โอน/ปิดหมดอายุ ทุกตัวคือ INSERT
 * ledger แถวใหม่เสมอ (ห้าม UPDATE ยอดคงเหลือตรง ๆ ดู CLAUDE.md ข้อ 7) ล็อกแถว MemberPackage ก่อนอ่าน/
 * เขียนยอดทุกครั้งกัน race condition (ดู MemberPackageService.lock, docs/decisions.md ADR-026)
 */
@Controller("branches/:branchId/member-packages")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MemberPackageActionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberPackageService: MemberPackageService,
  ) {}

  @Get(":memberPackageId")
  @RequirePermission("view", "package")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("memberPackageId") memberPackageId: string) {
    const record = await this.findOwned(branch.branchId, memberPackageId);
    const ledgerEntries = await this.prisma.client.memberPackageLedgerEntry.findMany({
      where: { memberPackageId },
      orderBy: { createdAt: "desc" },
    });
    const balance = ledgerEntries.reduce((sum, entry) => sum + entry.delta, 0);
    return { ...record, balance, ledgerEntries };
  }

  @Post(":memberPackageId/use")
  @RequirePermission("manage", "package")
  @AuditEntity("MemberPackage")
  async use(
    @CurrentBranch() branch: BranchContext,
    @Param("memberPackageId") memberPackageId: string,
    @Body(new ZodValidationPipe(useMemberPackageSchema)) body: UseMemberPackageInput,
  ) {
    const existing = await this.findOwned(branch.branchId, memberPackageId);
    if (body.approvedByUserId) {
      await this.memberPackageService.assertManagerApprover(branch.branchId, body.approvedByUserId);
    }

    return this.prisma.client.$transaction(async (tx) => {
      await this.memberPackageService.lock(tx, memberPackageId);
      const balance = await this.memberPackageService.getBalance(tx, memberPackageId);

      const result = validateUse({
        packageType: existing.type,
        currentBalance: balance,
        amount: body.amount,
        now: new Date(),
        expiresAt: existing.expiresAt,
        approvedByUserId: body.approvedByUserId ?? null,
      });
      if (!result.ok) throw new UnprocessableEntityException(result.reason);
      if (existing.status === "CLOSED") throw new ConflictException("คอร์สใบนี้ปิดแล้ว ใช้งานไม่ได้");

      const delta = existing.type === "UNLIMITED_DURATION" ? 0 : -body.amount;
      const ledgerEntry = await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId,
          kind: "USE",
          delta,
          note: body.note,
          approvedByUserId: body.approvedByUserId,
        },
      });
      return { ...existing, balance: balance + delta, ledgerEntry };
    });
  }

  @Post(":memberPackageId/refund")
  @RequirePermission("manage", "package")
  @AuditEntity("MemberPackage")
  async refund(
    @CurrentBranch() branch: BranchContext,
    @Param("memberPackageId") memberPackageId: string,
    @Body(new ZodValidationPipe(refundMemberPackageSchema)) body: RefundMemberPackageInput,
  ) {
    const existing = await this.findOwned(branch.branchId, memberPackageId);
    const originalEntry = await this.prisma.client.memberPackageLedgerEntry.findUnique({
      where: { id: body.ledgerEntryId },
    });
    if (!originalEntry || originalEntry.memberPackageId !== memberPackageId) {
      throw new NotFoundException("ไม่พบรายการที่จะคืนยอด");
    }
    if (originalEntry.kind !== "USE") {
      throw new UnprocessableEntityException("คืนยอดได้เฉพาะรายการตัดใช้ (USE) เท่านั้น");
    }
    const alreadyRefunded = await this.prisma.client.memberPackageLedgerEntry.findFirst({
      where: { memberPackageId, kind: "REFUND", relatedEntryId: originalEntry.id },
    });
    if (alreadyRefunded) {
      throw new ConflictException("รายการนี้ถูกคืนยอดไปแล้ว");
    }

    return this.prisma.client.$transaction(async (tx) => {
      await this.memberPackageService.lock(tx, memberPackageId);

      const result = validateRefund({
        originalUseDelta: originalEntry.delta,
        memberPackageStatus: existing.status,
      });
      if (!result.ok) throw new UnprocessableEntityException(result.reason);

      // คืนยอดเท่ากับที่ตัดไปเป๊ะ ๆ (ค่าตรงข้ามของ USE เดิม) — ไม่รับจำนวนจาก client เพื่อให้ยอดตรง 100% เสมอ
      const delta = -originalEntry.delta;
      const ledgerEntry = await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId,
          kind: "REFUND",
          delta,
          note: body.note,
          relatedEntryId: originalEntry.id,
        },
      });
      const balance = await this.memberPackageService.getBalance(tx, memberPackageId);
      return { ...existing, balance, ledgerEntry };
    });
  }

  @Post(":memberPackageId/freeze")
  @RequirePermission("manage", "package")
  @AuditEntity("MemberPackage")
  async freeze(
    @CurrentBranch() branch: BranchContext,
    @Param("memberPackageId") memberPackageId: string,
    @Body(new ZodValidationPipe(freezeMemberPackageSchema)) body: FreezeMemberPackageInput,
  ) {
    const existing = await this.findOwned(branch.branchId, memberPackageId);
    await this.memberPackageService.assertManagerApprover(branch.branchId, body.approvedByUserId);

    return this.prisma.client.$transaction(async (tx) => {
      await this.memberPackageService.lock(tx, memberPackageId);
      const frozenDaysUsed = await this.memberPackageService.getFrozenDaysUsed(tx, memberPackageId);

      const result = validateFreeze({
        requestedDays: body.days,
        cumulativeFreezeDaysUsed: frozenDaysUsed,
        approvedByUserId: body.approvedByUserId,
        memberPackageStatus: existing.status,
      });
      if (!result.ok) throw new UnprocessableEntityException(result.reason);

      const ledgerEntry = await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId,
          kind: "FREEZE",
          delta: 0,
          freezeDays: body.days,
          note: body.note,
          approvedByUserId: body.approvedByUserId,
        },
      });
      const newExpiresAt = new Date(existing.expiresAt.getTime() + body.days * MS_PER_DAY);
      const updated = await tx.memberPackage.update({
        where: { id: memberPackageId },
        data: { expiresAt: newExpiresAt },
      });
      const balance = await this.memberPackageService.getBalance(tx, memberPackageId);
      return { ...updated, balance, ledgerEntry };
    });
  }

  @Post(":memberPackageId/transfer")
  @RequirePermission("manage", "package")
  @AuditEntity("MemberPackage")
  async transfer(
    @CurrentBranch() branch: BranchContext,
    @Param("memberPackageId") memberPackageId: string,
    @Body(new ZodValidationPipe(transferMemberPackageSchema)) body: TransferMemberPackageInput,
  ) {
    const existing = await this.findOwned(branch.branchId, memberPackageId);
    const toMember = await this.prisma.client.member.findUnique({ where: { id: body.toMemberId } });
    if (!toMember || toMember.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบสมาชิกที่จะรับโอน");
    }

    return this.prisma.client.$transaction(async (tx) => {
      await this.memberPackageService.lock(tx, memberPackageId);
      const balance = await this.memberPackageService.getBalance(tx, memberPackageId);

      const result = validateTransfer({
        fromMemberId: existing.memberId,
        toMemberId: body.toMemberId,
        memberPackageStatus: existing.status,
        currentBalance: balance,
        packageType: existing.type,
      });
      if (!result.ok) throw new UnprocessableEntityException(result.reason);

      const outEntry = await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId,
          kind: "TRANSFER_OUT",
          delta: -balance,
          note: body.note,
        },
      });
      const closed = await tx.memberPackage.update({
        where: { id: memberPackageId },
        data: { status: "CLOSED" },
      });

      const newPackage = await tx.memberPackage.create({
        data: {
          branchId: branch.branchId,
          memberId: body.toMemberId,
          packageId: existing.packageId,
          name: existing.name,
          type: existing.type,
          priceSatang: existing.priceSatang,
          sessionCount: existing.sessionCount,
          valueSatang: existing.valueSatang,
          serviceVariantId: existing.serviceVariantId,
          purchasedAt: existing.purchasedAt,
          validDays: existing.validDays,
          expiresAt: existing.expiresAt,
        },
      });
      const inEntry = await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId: newPackage.id,
          kind: "TRANSFER_IN",
          delta: balance,
          note: body.note,
          relatedEntryId: outEntry.id,
        },
      });
      await tx.memberPackageLedgerEntry.update({
        where: { id: outEntry.id },
        data: { relatedEntryId: inEntry.id },
      });

      return { closed, transferred: { ...newPackage, balance } };
    });
  }

  @Post(":memberPackageId/expire")
  @RequirePermission("manage", "package")
  @AuditEntity("MemberPackage")
  async expire(
    @CurrentBranch() branch: BranchContext,
    @Param("memberPackageId") memberPackageId: string,
    @Body(new ZodValidationPipe(expireMemberPackageSchema)) body: ExpireMemberPackageInput,
  ) {
    const existing = await this.findOwned(branch.branchId, memberPackageId);
    await this.memberPackageService.assertManagerApprover(branch.branchId, body.approvedByUserId);

    return this.prisma.client.$transaction(async (tx) => {
      await this.memberPackageService.lock(tx, memberPackageId);
      const balance = await this.memberPackageService.getBalance(tx, memberPackageId);

      const result = validateExpire({
        memberPackageStatus: existing.status,
        approvedByUserId: body.approvedByUserId,
      });
      if (!result.ok) throw new UnprocessableEntityException(result.reason);

      const delta = existing.type === "UNLIMITED_DURATION" ? 0 : -balance;
      const ledgerEntry = await tx.memberPackageLedgerEntry.create({
        data: {
          branchId: branch.branchId,
          memberPackageId,
          kind: "EXPIRE",
          delta,
          note: body.note,
          approvedByUserId: body.approvedByUserId,
        },
      });
      const updated = await tx.memberPackage.update({
        where: { id: memberPackageId },
        data: { status: "CLOSED" },
      });
      return { ...updated, balance: balance + delta, ledgerEntry };
    });
  }

  private async findOwned(branchId: string, memberPackageId: string): Promise<MemberPackage> {
    const record = await this.prisma.client.memberPackage.findUnique({ where: { id: memberPackageId } });
    if (!record || record.branchId !== branchId) {
      throw new NotFoundException("ไม่พบคอร์สของสมาชิกนี้");
    }
    return record;
  }
}

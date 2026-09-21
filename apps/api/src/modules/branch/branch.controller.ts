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
import * as argon2 from "argon2";
import { Prisma } from "@lotus-desk/db";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateBranchSchema,
  updateUserSchema,
  type CreateUserInput,
  type ResetUserPasswordInput,
  type UpdateBranchInput,
  type UpdateUserInput,
} from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * ตัวอย่างการใช้ RBAC จริง (T1.4) — endpoint นี้คือที่มาของ:
 * "ผู้จัดการสาขา A เรียกข้อมูลสาขา B ต้องได้ 403 ทุก endpoint"
 * route param ต้องชื่อ :branchId ให้ตรงกับที่ PermissionGuard คาดหวัง
 */
@Controller("branches")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BranchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get(":branchId")
  @RequirePermission("view", "branch")
  async getBranch(@CurrentBranch() branch: BranchContext) {
    // PermissionGuard ยืนยันแล้วว่า user สังกัดสาขานี้จริง — ปลอดภัยที่จะดึงข้อมูลตรง ๆ ด้วย id
    const record = await this.prisma.client.branch.findUnique({ where: { id: branch.branchId } });
    if (!record) {
      throw new NotFoundException("ไม่พบสาขานี้");
    }
    return record;
  }

  @Get(":branchId/devices")
  @RequirePermission("view", "branch")
  async listDevices(@CurrentBranch() branch: BranchContext) {
    // ใช้ forBranch() แทน prisma.client ตรง ๆ — กันพลาดลืมกรอง branchId แม้ query จะยาวขึ้นในอนาคต
    return this.prisma.forBranch(branch.branchId).device.findMany({ orderBy: { label: "asc" } });
  }

  /**
   * ผู้ใช้ (บัญชี login) ของสาขานี้ — เพิ่มเพื่อให้หน้าเว็บเลือก "ผู้จัดการที่จะอนุมัติ" ได้ตอนกรอก PIN
   * ยกเลิกบิล (T5.6, ดู POST /auth/verify-manager-pin) กันสิทธิ์ด้วย staff:view เพราะแคชเชียร์ต้องเรียกได้
   * เหมือนกัน (ดู ROLE_PERMISSIONS ใน packages/contracts/src/permissions.ts) ไม่ใช่ endpoint จัดการผู้ใช้ —
   * ยังไม่มี CRUD ผู้ใช้ในระบบตอนนี้ (รอ Task ที่เกี่ยวกับ user management โดยตรง)
   */
  @Get(":branchId/users")
  @RequirePermission("view", "staff")
  async listUsers(
    @CurrentBranch() branch: BranchContext,
    // ค่าเริ่มต้น = active เท่านั้น (พฤติกรรมเดิมของ endpoint นี้ตอนใช้เลือก "ผู้จัดการที่จะอนุมัติ" — ห้าม
    // เปลี่ยน) ส่ง ?isActive=all เพื่อเห็น user ที่ปิดใช้งานด้วย (หน้าจัดการผู้ใช้ต้องเห็นเพื่อเปิดกลับได้)
    @Query("isActive") isActiveParam?: string,
  ) {
    const userBranches = await this.prisma.forBranch(branch.branchId).userBranch.findMany({
      where: isActiveParam === "all" ? {} : { user: { isActive: true } },
      include: { user: true, role: true },
      orderBy: { user: { name: "asc" } },
    });
    return userBranches.map((ub) => ({
      id: ub.user.id,
      name: ub.user.name,
      email: ub.user.email,
      roleKey: ub.role.key,
      roleName: ub.role.name,
      isActive: ub.user.isActive,
    }));
  }

  /**
   * สร้าง user ใหม่ + ผูกกับสาขานี้ทันที (T-ADR-060) — เกทด้วย settings:manage เหมือน endpoint อื่นในกลุ่ม
   * จัดการผู้ใช้ (ดู docs/decisions.md ADR-060) roleKey ต้องเป็น 1 ใน 4 role คงที่ที่ seed ไว้แล้วเท่านั้น
   * (ไม่มี CRUD role ในระบบนี้ — ดู ROLE_DEFINITIONS)
   */
  @Post(":branchId/users")
  @RequirePermission("manage", "settings")
  @AuditEntity("User")
  async createUser(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
  ) {
    const role = await this.prisma.client.role.findUnique({ where: { key: body.roleKey } });
    if (!role) {
      throw new NotFoundException("ไม่พบบทบาทนี้ในระบบ");
    }

    const passwordHash = await argon2.hash(body.password);
    try {
      const user = await this.prisma.client.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          isActive: true,
          branches: { create: { branchId: branch.branchId, roleId: role.id } },
        },
      });
      return { id: user.id, email: user.email, name: user.name, roleKey: role.key, roleName: role.name };
    } catch (err) {
      throw this.mapUserUniqueConflict(err);
    }
  }

  /**
   * แก้ชื่อ/อีเมล/บทบาท/เปิด-ปิดใช้งาน user คนนี้ (T-ADR-060) — "ลบ" user คือส่ง isActive: false มา
   * (soft delete ตาม pattern เดิมของ staff/room/service ทั้งระบบ กันประวัติ/บิล/ใบงานเก่าที่อ้างอิง user
   * คนนี้อยู่พังไปด้วย) ไม่มีฟิลด์รหัสผ่านที่นี่ — แก้รหัสผ่านแยกไปที่ PATCH .../password (ADR-059)
   */
  @Patch(":branchId/users/:userId")
  @RequirePermission("manage", "settings")
  @AuditEntity("User")
  async updateUser(
    @CurrentBranch() branch: BranchContext,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    const userBranch = await this.prisma.client.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId: branch.branchId } },
    });
    if (!userBranch) {
      throw new NotFoundException("ไม่พบผู้ใช้นี้ในสาขานี้");
    }

    let roleId: string | undefined;
    if (body.roleKey) {
      const role = await this.prisma.client.role.findUnique({ where: { key: body.roleKey } });
      if (!role) {
        throw new NotFoundException("ไม่พบบทบาทนี้ในระบบ");
      }
      roleId = role.id;
    }

    try {
      const user = await this.prisma.client.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.email !== undefined && { email: body.email }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
          },
        });
        if (roleId) {
          await tx.userBranch.update({
            where: { userId_branchId: { userId, branchId: branch.branchId } },
            data: { roleId },
          });
        }
        return updated;
      });
      // ปิดใช้งาน user คนนี้แล้ว = เพิกถอน session เดิมทั้งหมดด้วย เหตุผลเดียวกับ ADR-059 (บัญชีที่ถูกปิด
      // ไม่ควรใช้ token เก่าที่ยังไม่หมดอายุเข้าระบบต่อได้)
      if (body.isActive === false) {
        await this.authService.logoutAll(userId);
      }
      const finalUserBranch = await this.prisma.client.userBranch.findUnique({
        where: { userId_branchId: { userId, branchId: branch.branchId } },
        include: { role: true },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        roleKey: finalUserBranch?.role.key,
        roleName: finalUserBranch?.role.name,
      };
    } catch (err) {
      throw this.mapUserUniqueConflict(err);
    }
  }

  /**
   * User.email และ User.name เป็น unique field แยกกัน (name ใช้ login แทนอีเมลได้ตาม ADR-065) —
   * P2002 บอกได้ว่าชนกับ field ไหนผ่าน err.meta.target เอาไปทำข้อความ error ที่บอกสาเหตุจริงแทนเดาสุ่ม
   */
  private mapUserUniqueConflict(err: unknown): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
      if (fields.includes("name")) {
        return new ConflictException("มีผู้ใช้ชื่อนี้อยู่แล้วในระบบ — ชื่อต้องไม่ซ้ำเพราะใช้ login แทนอีเมลได้ด้วย");
      }
      return new ConflictException("อีเมลนี้มีผู้ใช้อยู่แล้วในระบบ");
    }
    return err as Error;
  }

  @Patch(":branchId")
  @RequirePermission("manage", "branch")
  @AuditEntity("Branch") // AuditInterceptor (global) จับคู่ :branchId กับ entity นี้อัตโนมัติ (ดู T1.5)
  async updateBranch(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchInput,
  ) {
    return this.prisma.client.branch.update({ where: { id: branch.branchId }, data: body });
  }

  /**
   * เจ้าของร้านตั้งรหัสผ่านใหม่ให้ user คนอื่นโดยตรง (ไม่ต้องรู้รหัสผ่านเดิม) — ยังไม่มีระบบส่งอีเมล reset
   * ในโปรเจกต์นี้ นี่คือทางแก้ชั่วคราวสำหรับกรณี user ลืมรหัสผ่านแล้วเข้าระบบไม่ได้ (ดู docs/decisions.md
   * ADR-059) เกทด้วย settings:manage ที่มีแค่ owner เท่านั้น (ดู packages/contracts/src/permissions.ts
   * MANAGE_ALL_EXCEPT_SETTINGS — manager ไม่มีสิทธิ์นี้โดยตั้งใจ)
   */
  @Patch(":branchId/users/:userId/password")
  @RequirePermission("manage", "settings")
  @AuditEntity("User")
  async resetUserPassword(
    @CurrentBranch() branch: BranchContext,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(resetUserPasswordSchema)) body: ResetUserPasswordInput,
  ) {
    // ต้องเช็คว่า user คนนี้สังกัดสาขานี้จริง ไม่งั้นผู้จัดการสาขา A จะตั้งรหัสผ่านให้ user สาขา B ได้
    // (PermissionGuard เช็คแค่ว่า "ผู้เรียก" สังกัดสาขานี้ ไม่ได้เช็ค "เป้าหมาย" ให้อัตโนมัติ)
    const userBranch = await this.prisma.client.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId: branch.branchId } },
    });
    if (!userBranch) {
      throw new NotFoundException("ไม่พบผู้ใช้นี้ในสาขานี้");
    }

    const passwordHash = await argon2.hash(body.newPassword);
    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    // เพิกถอน session เดิมทั้งหมดของ user คนนี้ — กันกรณีรหัสผ่านเดิมหลุด/ถูกขโมย session ที่ค้างอยู่ต้อง
    // ไม่ใช้ต่อได้อีกหลังรีเซ็ต (เหตุผลเดียวกับ RefreshTokenReuseException — ดู auth.service.ts)
    await this.authService.logoutAll(userId);
    return { id: user.id, email: user.email, name: user.name };
  }
}

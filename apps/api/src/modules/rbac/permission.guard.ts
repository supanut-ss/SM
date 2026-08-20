import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { buildAbility } from "./ability.factory";
import { REQUIRE_PERMISSION_KEY, type RequiredPermission } from "./require-permission.decorator";

export interface BranchContext {
  branchId: string;
  roleKey: string;
}

/**
 * ต้องรันหลัง JwtAuthGuard เสมอ (ใช้ request.user ที่ JwtAuthGuard ตั้งไว้)
 *
 * ขั้นตอน: หา branchId ที่ request นี้อ้างถึง -> เช็คว่า user คนนี้สังกัดสาขานั้นจริงไหม (UserBranch)
 * -> ถ้าไม่สังกัดเลย = 403 ทันที (ไม่บอกด้วยซ้ำว่าสาขานั้นมีจริงหรือเปล่า กันการสอดแนม)
 * -> ถ้าสังกัด ดึงสิทธิ์ของบทบาทที่สาขานั้น สร้าง CASL ability แล้วเช็คสิทธิ์ที่ endpoint ต้องการ
 *
 * นี่คือกลไกที่ทำให้ "ผู้จัดการสาขา A เรียกข้อมูลสาขา B ต้องได้ 403" เป็นจริงทุก endpoint ที่ใช้ guard นี้
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission | undefined>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!required) {
      // ไม่มี @RequirePermission ประกาศไว้ = guard นี้ไม่เกี่ยว ปล่อยผ่าน (เช็คที่อื่นถ้าจำเป็น)
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; branchContext?: BranchContext }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException("ต้องเข้าสู่ระบบก่อน");
    }

    const branchId = this.resolveBranchId(request);

    const userBranch = await this.prisma.client.userBranch.findUnique({
      where: { userId_branchId: { userId: user.sub, branchId } },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    if (!userBranch) {
      throw new ForbiddenException("คุณไม่มีสิทธิ์เข้าถึงข้อมูลของสาขานี้");
    }

    const permissionKeys = userBranch.role.permissions.map((rp) => rp.permission.key);
    const ability = buildAbility(permissionKeys);

    if (!ability.can(required.action, required.resource)) {
      throw new ForbiddenException(
        `ต้องมีสิทธิ์ "${required.resource}:${required.action}" — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอสิทธิ์`,
      );
    }

    request.branchContext = { branchId, roleKey: userBranch.role.key };
    return true;
  }

  private resolveBranchId(request: Request): string {
    const fromParam = request.params?.branchId;
    if (typeof fromParam === "string" && fromParam.length > 0) return fromParam;

    const fromHeader = request.headers["x-branch-id"];
    if (typeof fromHeader === "string" && fromHeader.length > 0) return fromHeader;

    throw new BadRequestException(
      "ไม่พบสาขาที่อ้างถึง — endpoint นี้ต้องมี route param :branchId หรือ header x-branch-id",
    );
  }
}

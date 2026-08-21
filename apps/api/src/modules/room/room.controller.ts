import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { createRoomSchema, updateRoomSchema, type CreateRoomInput, type UpdateRoomInput } from "@lotus-desk/contracts";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * ห้อง/เตียง (T2.2) — nested ใต้ /branches/:branchId/rooms เหมือนแพทเทิร์นของ StaffController (T2.1)
 * ประเภทห้อง (RoomType) เป็น catalog แยกต่อสาขา ยังไม่มี CRUD ของตัวเองใน Task นี้ — ดู
 * RoomTypeController สำหรับ endpoint อ่านอย่างเดียวที่ฟอร์มสร้าง/แก้ไขห้องใช้เติม dropdown
 */
@Controller("branches/:branchId/rooms")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoomController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "room")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("q") q?: string,
    @Query("isActive") isActiveParam?: string,
  ) {
    const isActive =
      isActiveParam === "all" ? undefined : isActiveParam === "false" ? false : true;
    const trimmedQuery = q?.trim();

    return this.prisma.forBranch(branch.branchId).room.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(trimmedQuery ? { name: { contains: trimmedQuery, mode: "insensitive" } } : {}),
      },
      include: { roomType: true },
      orderBy: { name: "asc" },
    });
  }

  @Get(":roomId")
  @RequirePermission("view", "room")
  async getOne(@CurrentBranch() branch: BranchContext, @Param("roomId") roomId: string) {
    const record = await this.prisma.client.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!record || record.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบห้องนี้");
    }
    return record;
  }

  @Post()
  @RequirePermission("manage", "room")
  @AuditEntity("Room")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createRoomSchema)) body: CreateRoomInput,
  ) {
    await this.assertRoomTypeInBranch(branch.branchId, body.roomTypeId);
    return this.prisma.client.room.create({
      data: { ...body, branchId: branch.branchId },
      include: { roomType: true },
    });
  }

  @Patch(":roomId")
  @RequirePermission("manage", "room")
  @AuditEntity("Room")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("roomId") roomId: string,
    @Body(new ZodValidationPipe(updateRoomSchema)) body: UpdateRoomInput,
  ) {
    const existing = await this.prisma.client.room.findUnique({ where: { id: roomId } });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบห้องนี้");
    }
    if (body.roomTypeId) {
      await this.assertRoomTypeInBranch(branch.branchId, body.roomTypeId);
    }
    return this.prisma.client.room.update({
      where: { id: roomId },
      data: body,
      include: { roomType: true },
    });
  }

  /** กันเลือกประเภทห้องข้ามสาขา (RoomType เป็น catalog แยกต่อสาขาเหมือนกัน) */
  private async assertRoomTypeInBranch(branchId: string, roomTypeId: string): Promise<void> {
    const roomType = await this.prisma.client.roomType.findUnique({ where: { id: roomTypeId } });
    if (!roomType || roomType.branchId !== branchId) {
      throw new NotFoundException("ไม่พบประเภทห้องนี้ในสาขานี้");
    }
  }
}

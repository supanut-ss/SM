import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@lotus-desk/db";
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  type CreateRoomTypeInput,
  type UpdateRoomTypeInput,
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
 * เดิมอ่านอย่างเดียว (T2.2, ดู docs/decisions.md ADR-010) — เพิ่ม create/update/delete ตอนนี้ตามคำขอ
 * ผู้ใช้ (ดู ADR-062) ไม่มี isActive ในสคีมา (RoomType ไม่เคยออกแบบให้ soft delete) จึง "ลบ" ได้จริงเฉพาะตอน
 * ไม่มีห้อง/บริการอ้างอิงอยู่เท่านั้น — ถ้ามีอ้างอิงคืน 409 พร้อมบอกเหตุผล ไม่ได้เปิดให้ปิดใช้งานแทน
 */
@Controller("branches/:branchId/room-types")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoomTypeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "room")
  async list(@CurrentBranch() branch: BranchContext) {
    return this.prisma.forBranch(branch.branchId).roomType.findMany({
      orderBy: { name: "asc" },
    });
  }

  @Post()
  @RequirePermission("manage", "room")
  @AuditEntity("RoomType")
  async create(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createRoomTypeSchema)) body: CreateRoomTypeInput,
  ) {
    try {
      return await this.prisma.client.roomType.create({
        data: { branchId: branch.branchId, name: body.name },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("มีประเภทห้องชื่อนี้อยู่แล้วในสาขานี้");
      }
      throw err;
    }
  }

  @Patch(":roomTypeId")
  @RequirePermission("manage", "room")
  @AuditEntity("RoomType")
  async update(
    @CurrentBranch() branch: BranchContext,
    @Param("roomTypeId") roomTypeId: string,
    @Body(new ZodValidationPipe(updateRoomTypeSchema)) body: UpdateRoomTypeInput,
  ) {
    const existing = await this.prisma.client.roomType.findUnique({ where: { id: roomTypeId } });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบประเภทห้องนี้ในสาขานี้");
    }
    try {
      return await this.prisma.client.roomType.update({
        where: { id: roomTypeId },
        data: { name: body.name },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("มีประเภทห้องชื่อนี้อยู่แล้วในสาขานี้");
      }
      throw err;
    }
  }

  @Delete(":roomTypeId")
  @RequirePermission("manage", "room")
  @AuditEntity("RoomType")
  async remove(@CurrentBranch() branch: BranchContext, @Param("roomTypeId") roomTypeId: string) {
    const existing = await this.prisma.client.roomType.findUnique({ where: { id: roomTypeId } });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบประเภทห้องนี้ในสาขานี้");
    }

    const [roomCount, variantCount] = await Promise.all([
      this.prisma.client.room.count({ where: { roomTypeId } }),
      this.prisma.client.serviceVariant.count({ where: { requiredRoomTypeId: roomTypeId } }),
    ]);
    if (roomCount > 0 || variantCount > 0) {
      throw new ConflictException(
        `ลบไม่ได้ — มีห้อง ${roomCount} ห้องและบริการ ${variantCount} รายการที่ใช้ประเภทห้องนี้อยู่ ต้องย้าย/ลบสิ่งที่อ้างอิงก่อน`,
      );
    }

    try {
      await this.prisma.client.roomType.delete({ where: { id: roomTypeId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException(
          "ลบไม่ได้ — มีห้องหรือบริการที่ใช้ประเภทห้องนี้อยู่ ต้องย้าย/ลบสิ่งที่อ้างอิงก่อน",
        );
      }
      throw err;
    }
    return { ok: true };
  }
}

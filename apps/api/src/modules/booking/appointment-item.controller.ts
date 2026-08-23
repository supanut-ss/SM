import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  APPOINTMENT_STATUS_LABEL,
  STAFF_SKILL_LABEL,
  canTransitionAppointmentStatus,
  rescheduleAppointmentItemSchema,
  updateAppointmentItemStatusSchema,
  type RescheduleAppointmentItemInput,
  type UpdateAppointmentItemStatusInput,
} from "@lotus-desk/contracts";
import { Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { bangkokDayRange, toBangkokDateOnly } from "./bangkok-date";
import { moveToFront, reorderAfterJobCompleted, type QueueEntry } from "./staff-queue";
import type { BranchContext } from "../rbac/permission.guard";

/** exclusion_violation ของ Postgres (T4.2) ไม่มี Prisma error code เฉพาะของตัวเอง (ต่างจาก unique
 * constraint ที่มี P2002) — Prisma โยนเป็น PrismaClientUnknownRequestError ที่มีแค่ raw message ต้องเช็ค
 * ด้วยเลข SQLSTATE "23P01" ในข้อความเอง ดู docs/decisions.md ADR-023 */
function isExclusionViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientUnknownRequestError && err.message.includes("23P01");
}

/**
 * เปลี่ยนสถานะของ AppointmentItem (T4.3) — สถานะอยู่ระดับ item ไม่ใช่ Appointment โดยตั้งใจ (ดู
 * docs/decisions.md ADR-020) กติกาว่าข้ามสถานะไหนได้บ้างอยู่ที่ canTransitionAppointmentStatus ใน
 * packages/contracts (pure function ใช้ร่วมกับฝั่งเว็บได้ตอน T4.5 Lane Board เพื่อปิดปุ่มที่ข้ามไม่ได้
 * ก่อนยิง request จริงด้วยซ้ำ) ดู docs/decisions.md ADR-021 สำหรับกติกาเต็ม
 *
 * จบงาน (→ COMPLETED) หรือยกเลิก/ไม่มา (→ CANCELLED/NO_SHOW) กระทบคิวหมุนด้วย (T4.4) — ทำในทรานแซกชัน
 * เดียวกับการอัปเดตสถานะเสมอ กัน state ไม่ตรงกันถ้า process ล่มกลางคัน ดู docs/decisions.md ADR-022
 *
 * ยังไม่มี endpoint สร้างนัดใหม่ที่นี่ (รอ Task ที่จะสร้าง booking flow จริง — T4.5/T4.6)
 */
@Controller("branches/:branchId/appointment-items")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentItemController {
  constructor(private readonly prisma: PrismaService) {}

  /** รายการนัดของวันที่ระบุ (ค่าเริ่มต้น = วันนี้ตามเวลาไทย) — ใช้วาด Lane Board (T4.5) */
  @Get()
  @RequirePermission("view", "booking")
  async list(@CurrentBranch() branch: BranchContext, @Query("date") dateParam?: string) {
    const { start, end } = bangkokDayRange(dateParam ? new Date(dateParam) : new Date());
    return this.prisma.forBranch(branch.branchId).appointmentItem.findMany({
      where: { startAt: { gte: start, lt: end } },
      include: {
        staff: true,
        room: true,
        serviceVariant: { include: { service: true } },
        appointment: { include: { member: true } },
      },
      orderBy: { startAt: "asc" },
    });
  }

  /**
   * ลากวาง/ย่อขยายบล็อกบน Lane Board (T4.5) — เปลี่ยนพนักงาน/ห้อง/เวลาของนัดที่มีอยู่แล้ว คนละ endpoint
   * กับ updateStatus (T4.3) ที่เปลี่ยนแค่สถานะ — ตรวจทักษะ/ประเภทห้องที่ระดับ application ก่อน แล้วปล่อยให้
   * EXCLUDE constraint (T4.2) เป็นด่านสุดท้ายกันชนจริงภายใต้ concurrent request (ดู docs/decisions.md
   * ADR-023) ยังไม่เช็คว่าอยู่ในกะพนักงานหรือไม่ (ไม่ได้ผูก availability engine เต็มรูปจาก T4.1 — ดู ADR
   * เดียวกัน สำหรับเหตุผลที่ยังไม่ทำตอนนี้)
   */
  @Patch(":appointmentItemId/reschedule")
  @RequirePermission("manage", "booking")
  @AuditEntity("AppointmentItem")
  async reschedule(
    @CurrentBranch() branch: BranchContext,
    @Param("appointmentItemId") appointmentItemId: string,
    @Body(new ZodValidationPipe(rescheduleAppointmentItemSchema)) body: RescheduleAppointmentItemInput,
  ) {
    const existing = await this.prisma.client.appointmentItem.findUnique({
      where: { id: appointmentItemId },
      include: { serviceVariant: true },
    });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบรายการนัดนี้");
    }

    const staff = await this.prisma.client.staffProfile.findUnique({ where: { id: body.staffId } });
    if (!staff || staff.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบพนักงานนี้ในสาขานี้");
    }
    if (!staff.skills.includes(existing.serviceVariant.requiredSkill)) {
      throw new UnprocessableEntityException(
        `พนักงานคนนี้ไม่มีทักษะ "${STAFF_SKILL_LABEL[existing.serviceVariant.requiredSkill]}" ที่บริการนี้ต้องใช้`,
      );
    }

    const room = await this.prisma.client.room.findUnique({ where: { id: body.roomId } });
    if (!room || room.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบห้องนี้ในสาขานี้");
    }
    if (room.roomTypeId !== existing.serviceVariant.requiredRoomTypeId) {
      throw new UnprocessableEntityException("ห้องนี้ไม่ตรงกับประเภทห้องที่บริการนี้ต้องใช้");
    }

    try {
      return await this.prisma.client.appointmentItem.update({
        where: { id: appointmentItemId },
        data: {
          staffId: body.staffId,
          roomId: body.roomId,
          startAt: body.startAt,
          endAt: body.endAt,
          roomCapacityAtBooking: room.capacity,
        },
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new ConflictException("ช่วงเวลานี้ชนกับนัดอื่นของพนักงานหรือห้องนี้แล้ว");
      }
      throw err;
    }
  }

  @Patch(":appointmentItemId/status")
  @RequirePermission("manage", "booking")
  @AuditEntity("AppointmentItem")
  async updateStatus(
    @CurrentBranch() branch: BranchContext,
    @Param("appointmentItemId") appointmentItemId: string,
    @Body(new ZodValidationPipe(updateAppointmentItemStatusSchema))
    body: UpdateAppointmentItemStatusInput,
  ) {
    const existing = await this.prisma.client.appointmentItem.findUnique({
      where: { id: appointmentItemId },
    });
    if (!existing || existing.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบรายการนัดนี้");
    }

    if (!canTransitionAppointmentStatus(existing.status, body.status)) {
      throw new UnprocessableEntityException(
        `เปลี่ยนสถานะจาก "${APPOINTMENT_STATUS_LABEL[existing.status]}" ไปเป็น ` +
          `"${APPOINTMENT_STATUS_LABEL[body.status]}" ไม่ได้ — ข้ามลำดับสถานะที่อนุญาต`,
      );
    }

    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.appointmentItem.update({
        where: { id: appointmentItemId },
        data: { status: body.status },
      });

      if (body.status === "COMPLETED" || body.status === "CANCELLED" || body.status === "NO_SHOW") {
        await this.applyQueueEffect(tx, branch.branchId, existing, body.status);
      }

      return updated;
    });
  }

  private async applyQueueEffect(
    tx: Prisma.TransactionClient,
    branchId: string,
    item: { staffId: string; startAt: Date; assignType: "ROTATION" | "CUSTOMER_REQUEST" },
    newStatus: "COMPLETED" | "CANCELLED" | "NO_SHOW",
  ): Promise<void> {
    const date = toBangkokDateOnly(item.startAt);
    const rows = await tx.staffQueueEntry.findMany({ where: { branchId, date } });
    const before: QueueEntry[] = rows.map((r) => ({ staffId: r.staffId, position: r.position }));

    let after: QueueEntry[];
    if (newStatus === "COMPLETED") {
      const branchRecord = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
      after = reorderAfterJobCompleted(
        before,
        item.staffId,
        item.assignType,
        branchRecord.customRequestKeepsQueuePosition,
      );
    } else {
      // CANCELLED/NO_SHOW ก่อนเช็คอินเสมอ (ตามกติกาการข้ามสถานะ T4.3) — ไม่ใช่ความผิดพนักงาน
      // จึงกลับไปหัวคิวเหมือนกันทั้งสองกรณี (ดู docs/DOMAIN.md ข้อ 3, docs/decisions.md ADR-022)
      after = moveToFront(before, item.staffId);
    }

    for (const entry of after) {
      const existingRow = rows.find((r) => r.staffId === entry.staffId);
      if (existingRow) {
        if (existingRow.position !== entry.position) {
          await tx.staffQueueEntry.update({ where: { id: existingRow.id }, data: { position: entry.position } });
        }
      } else {
        await tx.staffQueueEntry.create({
          data: { branchId, staffId: entry.staffId, date, position: entry.position },
        });
      }
    }
  }
}

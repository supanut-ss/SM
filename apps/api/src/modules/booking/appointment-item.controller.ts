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
  APPOINTMENT_STATUS_LABEL,
  STAFF_SKILL_LABEL,
  canTransitionAppointmentStatus,
  createWalkInAppointmentSchema,
  rescheduleAppointmentItemSchema,
  updateAppointmentItemStatusSchema,
  type CreateWalkInAppointmentInput,
  type RescheduleAppointmentItemInput,
  type UpdateAppointmentItemStatusInput,
} from "@lotus-desk/contracts";
import { findAvailableSlots } from "@lotus-desk/core";
import { Prisma } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { bangkokDayRange, bangkokMinutesToInstant, toBangkokDateOnly } from "./bangkok-date";
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
 * จองด่วนจากคิวหมุน (T4.6) เป็น endpoint สร้างนัดใหม่ตัวแรกในระบบ — ใช้ findAvailableSlots (T4.1) เต็มรูป
 * เพราะไม่มี "นัดเดิม" ให้อ้างอิงเหมือน reschedule (ดู docs/decisions.md ADR-024)
 */
@Controller("branches/:branchId/appointment-items")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentItemController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * จองด่วนจากคิวหมุน + เช็คอินทันที (T4.6) — ลูกค้า walk-in ยืนอยู่หน้าร้านแล้ว ไม่ต้องผ่านขั้น
   * BOOKED/CONFIRMED (ใช้ทางลัดของ state machine ใน T4.3) ระบบเลือกพนักงาน+ห้องให้เองจาก:
   *   1. คนที่มีทักษะตรง + ห้องประเภทตรง + ว่างจริง "ตอนนี้" (findAvailableSlots ของ T4.1)
   *   2. ในกลุ่มที่ว่างพร้อมกันเร็วที่สุด เลือกคนที่อยู่หัวคิวหมุนที่สุด (ดู docs/decisions.md ADR-024)
   * ไม่รับ staffId/roomId จาก client เลย — ตรงกับชื่อ "จองด่วนจากคิวหมุน" (ถ้าอยากเลือกเองต้องใช้ Lane
   * Board ลาก-วางแทน ไม่ใช่ endpoint นี้)
   */
  @Post("walk-in")
  @RequirePermission("manage", "booking")
  @AuditEntity("AppointmentItem")
  async createWalkIn(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(createWalkInAppointmentSchema)) body: CreateWalkInAppointmentInput,
  ) {
    const variant = await this.prisma.client.serviceVariant.findUnique({
      where: { id: body.serviceVariantId },
      include: { service: true },
    });
    if (!variant || variant.service.branchId !== branch.branchId) {
      throw new NotFoundException("ไม่พบบริการนี้ในสาขานี้");
    }

    const now = new Date();
    const dateLabel = toBangkokDateOnly(now);
    const { start: dayStart, end: dayEnd } = bangkokDayRange(now);

    const [staffList, rooms, queueEntries, shiftsToday, leavesToday, existingToday] = await Promise.all([
      this.prisma.client.staffProfile.findMany({ where: { branchId: branch.branchId, isActive: true } }),
      this.prisma.client.room.findMany({
        where: { branchId: branch.branchId, roomTypeId: variant.requiredRoomTypeId, isActive: true },
      }),
      this.prisma.client.staffQueueEntry.findMany({ where: { branchId: branch.branchId, date: dateLabel } }),
      this.prisma.client.staffShift.findMany({ where: { branchId: branch.branchId, date: dateLabel } }),
      this.prisma.client.staffLeave.findMany({ where: { branchId: branch.branchId, date: dateLabel } }),
      this.prisma.client.appointmentItem.findMany({
        where: {
          branchId: branch.branchId,
          startAt: { gte: dayStart, lt: dayEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
    ]);

    if (rooms.length === 0) {
      throw new UnprocessableEntityException("ไม่มีห้องที่รองรับบริการนี้ในสาขานี้");
    }

    const slots = findAvailableSlots({
      now,
      date: now,
      shifts: shiftsToday.map((s) => ({
        staffId: s.staffId,
        start: bangkokMinutesToInstant(dateLabel, s.startMin),
        end: bangkokMinutesToInstant(dateLabel, s.endMin),
      })),
      leaves: leavesToday.map((l) => ({ staffId: l.staffId })),
      existing: existingToday.map((i) => ({
        staffId: i.staffId,
        roomId: i.roomId,
        start: i.startAt,
        end: i.endAt,
      })),
      staff: staffList.map((s) => ({ id: s.id, skills: s.skills, level: s.level })),
      rooms: rooms.map((r) => ({ id: r.id, roomTypeId: r.roomTypeId, capacity: r.capacity })),
      service: {
        durationMin: variant.durationMin,
        bufferBeforeMin: variant.bufferBeforeMin,
        bufferAfterMin: variant.bufferAfterMin,
        requiredSkill: variant.requiredSkill,
        requiredRoomTypeId: variant.requiredRoomTypeId,
      },
      granularityMin: 15,
    });

    if (slots.length === 0) {
      throw new UnprocessableEntityException("ไม่มีพนักงานว่างสำหรับบริการนี้ในตอนนี้ กรุณาลองใหม่ภายหลัง");
    }

    // เอาเฉพาะช่องที่เริ่ม "เร็วที่สุด" (ตอนนี้เลยถ้าเป็นไปได้) แล้วในกลุ่มนั้นเลือกคนที่อยู่หัวคิวที่สุด
    const earliestStart = Math.min(...slots.map((s) => s.start.getTime()));
    const earliestSlots = slots.filter((s) => s.start.getTime() === earliestStart);
    const queuePosition = new Map(queueEntries.map((e) => [e.staffId, e.position]));
    earliestSlots.sort(
      (a, b) => (queuePosition.get(a.staffId) ?? Infinity) - (queuePosition.get(b.staffId) ?? Infinity),
    );
    const chosen = earliestSlots[0]!;
    const room = rooms.find((r) => r.id === chosen.roomId)!;

    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const appointment = await tx.appointment.create({
          data: { branchId: branch.branchId, memberId: body.memberId ?? null },
        });
        return tx.appointmentItem.create({
          data: {
            branchId: branch.branchId,
            appointmentId: appointment.id,
            staffId: chosen.staffId,
            roomId: chosen.roomId,
            serviceVariantId: variant.id,
            status: "CHECKED_IN",
            assignType: "ROTATION",
            startAt: chosen.start,
            endAt: chosen.end,
            roomCapacityAtBooking: room.capacity,
          },
          include: {
            staff: true,
            room: true,
            serviceVariant: { include: { service: true } },
            appointment: { include: { member: true } },
          },
        });
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new ConflictException("ช่องที่เลือกเพิ่งถูกจองไปแล้วพอดี กรุณาลองจองด่วนใหม่อีกครั้ง");
      }
      throw err;
    }
  }

  /**
   * รายการนัดของวันที่ระบุ (ค่าเริ่มต้น = วันนี้ตามเวลาไทย) — ใช้วาด Lane Board (T4.5) รวมถึงหน้าบิล (T5.6)
   * ที่ต้องเช็คว่าใบงานไหน "จบงานแล้วแต่ยังไม่ออกบิล" ได้ (serviceJob.completedAt ไม่ null แต่ billLine null)
   */
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
        serviceJob: { include: { billLine: true } },
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
      include: { serviceVariant: true, staff: true },
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

      if (body.status === "IN_SERVICE") {
        await this.startServiceJob(tx, branch.branchId, existing);
      }
      if (body.status === "COMPLETED") {
        await this.completeServiceJob(tx, appointmentItemId, body.paymentMethod!);
      }
      if (body.status === "COMPLETED" || body.status === "CANCELLED" || body.status === "NO_SHOW") {
        await this.applyQueueEffect(tx, branch.branchId, existing, body.status);
      }

      return updated;
    });
  }

  /**
   * เริ่มงาน (T5.5) — สร้าง ServiceJob อัตโนมัติตอนเข้า IN_SERVICE พร้อม snapshot ราคา/ระดับพนักงาน/ค่ามือ
   * ณ ตอนนี้ทันที (ไม่ join กลับไปอ่าน ServiceVariant สดทีหลังเด็ดขาด) เลือกอัตราค่ามือ 1 ใน 3 เรตให้ตรงกับ
   * staff.level ตอนนี้ (ดู docs/DOMAIN.md ข้อ 9-10, docs/decisions.md ADR-029)
   */
  private async startServiceJob(
    tx: Prisma.TransactionClient,
    branchId: string,
    item: {
      id: string;
      staffId: string;
      roomId: string;
      serviceVariantId: string;
      assignType: "ROTATION" | "CUSTOMER_REQUEST";
      serviceVariant: {
        priceSatang: number;
        commissionJuniorSatang: number;
        commissionSeniorSatang: number;
        commissionMasterSatang: number;
      };
      staff: { level: "JUNIOR" | "SENIOR" | "MASTER" };
    },
  ): Promise<void> {
    const commissionByLevel = {
      JUNIOR: item.serviceVariant.commissionJuniorSatang,
      SENIOR: item.serviceVariant.commissionSeniorSatang,
      MASTER: item.serviceVariant.commissionMasterSatang,
    } as const;

    await tx.serviceJob.create({
      data: {
        branchId,
        appointmentItemId: item.id,
        staffId: item.staffId,
        roomId: item.roomId,
        serviceVariantId: item.serviceVariantId,
        assignType: item.assignType,
        priceSatang: item.serviceVariant.priceSatang,
        staffLevelAtJob: item.staff.level,
        commissionSatang: commissionByLevel[item.staff.level],
        startedAt: new Date(),
      },
    });
  }

  /** จบงาน (T5.5) — ปิด ServiceJob ที่เปิดค้างไว้ พร้อมแหล่งชำระที่ตัดสินใจตอนนี้เท่านั้น (ดู ADR-029) */
  private async completeServiceJob(
    tx: Prisma.TransactionClient,
    appointmentItemId: string,
    paymentMethod: "CASH" | "PACKAGE" | "VOUCHER" | "COMPLIMENTARY" | "TRANSFER",
  ): Promise<void> {
    // updateMany (ไม่ใช่ update) โดยตั้งใจ — ไม่ throw ถ้าไม่มี ServiceJob อยู่จริง (เช่นนัดเก่าที่ถูกเซ็ต
    // เป็น IN_SERVICE ไว้ก่อนมี T5.5 หรือข้อมูลที่ import มาโดยไม่ผ่าน endpoint เริ่มงาน) ปิดงานได้ปกติ
    // แต่จะไม่มีใบงานให้บันทึกราคา/ค่ามือ (ไม่ใช่ error ของผู้ใช้ที่กำลังปิดงานตรงหน้า)
    await tx.serviceJob.updateMany({
      where: { appointmentItemId },
      data: { completedAt: new Date(), paymentMethod },
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

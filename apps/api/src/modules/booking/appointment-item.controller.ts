import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  APPOINTMENT_STATUS_LABEL,
  canTransitionAppointmentStatus,
  updateAppointmentItemStatusSchema,
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
import { toBangkokDateOnly } from "./bangkok-date";
import { moveToFront, reorderAfterJobCompleted, type QueueEntry } from "./staff-queue";
import type { BranchContext } from "../rbac/permission.guard";

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

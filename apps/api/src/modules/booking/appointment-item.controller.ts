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
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

/**
 * เปลี่ยนสถานะของ AppointmentItem (T4.3) — สถานะอยู่ระดับ item ไม่ใช่ Appointment โดยตั้งใจ (ดู
 * docs/decisions.md ADR-020) กติกาว่าข้ามสถานะไหนได้บ้างอยู่ที่ canTransitionAppointmentStatus ใน
 * packages/contracts (pure function ใช้ร่วมกับฝั่งเว็บได้ตอน T4.5 Lane Board เพื่อปิดปุ่มที่ข้ามไม่ได้
 * ก่อนยิง request จริงด้วยซ้ำ) ดู docs/decisions.md ADR-021 สำหรับกติกาเต็ม
 *
 * ยังไม่มี endpoint สร้างนัดใหม่ที่นี่ (รอ Task ที่จะสร้าง booking flow จริง — T4.4/T4.5/T4.6) T4.3 มีแค่
 * การเปลี่ยนสถานะของนัดที่มีอยู่แล้วเท่านั้น ตามขอบเขตที่ระบุไว้
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

    return this.prisma.client.appointmentItem.update({
      where: { id: appointmentItemId },
      data: { status: body.status },
    });
  }
}

import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { clockActionSchema, type ClockActionInput } from "@lotus-desk/contracts";
import { evaluateAttendance } from "@lotus-desk/core";
import type { StaffProfile } from "@lotus-desk/db";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";
import { PIN_LOCKOUT_MS, PIN_MAX_ATTEMPTS } from "../auth/token.util";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { bangkokDayRange, bangkokMinuteOfDay, toBangkokDateOnly } from "./bangkok-time";

/** "YYYY-MM-DD" ตรง ๆ → Date เที่ยงคืน UTC ของวันปฏิทินไทยวันนั้น (เทคนิคเดียวกับ toBangkokDateOnly) */
function parseDateOnlyParam(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new UnprocessableEntityException("รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD");
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/**
 * ลงเวลาเข้า-ออกงานพนักงานให้บริการที่เครื่องหน้าร้าน (T6.1) — ยืนยันตัวตนด้วย StaffProfile.pinHash
 * (คนละระบบจาก User PIN login ของ T1.3) คำนวณสาย/ขาด/OT ผ่าน evaluateAttendance (packages/core/attendance)
 * ไม่มี service แยก — logic อยู่ในคอนโทรลเลอร์นี้ทั้งหมดตามแพทเทิร์นโมดูลขนาดนี้ (ดู CashierShiftModule)
 *
 * PIN เป็น "ทางเลือก" ไม่ใช่ "บังคับ" — ร้านนี้พนักงานให้บริการไม่แตะระบบเลย แคชเชียร์/ผู้จัดการ/เจ้าของ
 * เป็นคนลงเวลาแทนพนักงานทุกครั้งจากเครื่องหน้าร้าน (เหมือนการจอง/เริ่ม-จบใบงาน/เช็คเอาต์ทั้งหมดในระบบนี้)
 * สิทธิ์ attendance:manage ที่ route guard บังคับอยู่แล้วถือเป็นการยืนยันตัวตนที่เพียงพอสำหรับกรณีนี้
 * ถ้ามีการส่ง pin มาด้วย (เผื่ออนาคตอยากเปิดโหมดพนักงานกรอกเองที่เครื่อง) ระบบยังตรวจสอบ/ล็อกเอาต์ตามปกติ
 * — ดู verifyStaffPin ด้านล่าง ไม่ได้ถูกลบหรือปิดการใช้งาน
 */
@Controller("branches/:branchId/attendance")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("clock-in")
  @RequirePermission("manage", "attendance")
  @AuditEntity("TimeClockEntry")
  async clockIn(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(clockActionSchema)) body: ClockActionInput,
  ) {
    const staff = await this.loadActiveStaff(branch.branchId, body.staffId);
    if (body.pin) {
      await this.verifyStaffPin(staff, body.pin);
    }

    const now = new Date();

    const openEntry = await this.prisma.forBranch(branch.branchId).timeClockEntry.findFirst({
      where: { staffId: staff.id, clockOutAt: null },
    });
    if (openEntry) {
      throw new ConflictException("พนักงานคนนี้ลงเวลาเข้างานค้างอยู่แล้ว ต้องลงเวลาออกก่อน");
    }

    const todayShifts = await this.prisma.forBranch(branch.branchId).staffShift.findMany({
      where: { staffId: staff.id, date: toBangkokDateOnly(now) },
    });
    const nowMinuteOfDay = bangkokMinuteOfDay(now);
    const matchedShift = todayShifts.reduce<(typeof todayShifts)[number] | null>((closest, shift) => {
      if (!closest) return shift;
      const closestDiff = Math.abs(closest.startMin - nowMinuteOfDay);
      const shiftDiff = Math.abs(shift.startMin - nowMinuteOfDay);
      return shiftDiff < closestDiff ? shift : closest;
    }, null);

    const entry = await this.prisma.client.timeClockEntry.create({
      data: {
        branchId: branch.branchId,
        staffId: staff.id,
        staffShiftId: matchedShift?.id ?? null,
        clockInAt: now,
      },
    });

    const attendance = evaluateAttendance({
      shiftStartMin: matchedShift?.startMin ?? null,
      shiftEndMin: matchedShift?.endMin ?? null,
      clockInMinuteOfDay: nowMinuteOfDay,
      clockOutMinuteOfDay: null,
    });

    // `id` ซ้ำกับ entry.id ที่ระดับบน — AuditInterceptor หา entityId จาก paramName (ที่นี่ไม่มี เพราะ
    // staffId มาจาก body ไม่ใช่ route param) ไม่เจอก็ fallback ไปอ่าน `after.id` ตรง ๆ (ดู audit.interceptor.ts)
    return { id: entry.id, entry, attendance };
  }

  @Post("clock-out")
  @RequirePermission("manage", "attendance")
  @AuditEntity("TimeClockEntry")
  async clockOut(
    @CurrentBranch() branch: BranchContext,
    @Body(new ZodValidationPipe(clockActionSchema)) body: ClockActionInput,
  ) {
    const staff = await this.loadActiveStaff(branch.branchId, body.staffId);
    if (body.pin) {
      await this.verifyStaffPin(staff, body.pin);
    }

    const openEntry = await this.prisma.forBranch(branch.branchId).timeClockEntry.findFirst({
      where: { staffId: staff.id, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });
    if (!openEntry) {
      throw new UnprocessableEntityException("พนักงานคนนี้ยังไม่ได้ลงเวลาเข้างาน");
    }

    const now = new Date();
    const matchedShift = openEntry.staffShiftId
      ? await this.prisma.forBranch(branch.branchId).staffShift.findFirst({
          where: { id: openEntry.staffShiftId },
        })
      : null;

    const entry = await this.prisma.client.timeClockEntry.update({
      where: { id: openEntry.id },
      data: { clockOutAt: now },
    });

    const attendance = evaluateAttendance({
      shiftStartMin: matchedShift?.startMin ?? null,
      shiftEndMin: matchedShift?.endMin ?? null,
      clockInMinuteOfDay: bangkokMinuteOfDay(entry.clockInAt),
      clockOutMinuteOfDay: bangkokMinuteOfDay(now),
    });

    return { id: entry.id, entry, attendance };
  }

  /**
   * รายการลงเวลาของวันที่กำหนด (default = วันนี้ตามเวลาไทย) — union พนักงานที่มีกะและ/หรือมีรายการลงเวลา
   * รายงานเดียว ไม่ต้องแบ่งหน้า (สาขาหนึ่งมีพนักงานหลักสิบคนต่อวัน) — ถ้าพนักงานคนหนึ่งมีหลายกะในวันเดียว
   * (กะแยก) ใช้กะที่ผูกกับ TimeClockEntry จริงถ้ามี ไม่งั้น fallback เป็นกะแรกสุดของวันนั้น (เรียงตาม startMin)
   */
  @Get()
  @RequirePermission("view", "attendance")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("date") dateParam?: string,
    @Query("staffId") staffIdFilter?: string,
  ) {
    const dateOnly = dateParam ? parseDateOnlyParam(dateParam) : toBangkokDateOnly(new Date());
    const { start, end } = bangkokDayRange(dateOnly);

    const shifts = await this.prisma.forBranch(branch.branchId).staffShift.findMany({
      where: { date: dateOnly },
      orderBy: { startMin: "asc" },
      select: { id: true, staffId: true, startMin: true, endMin: true },
    });
    const entries = await this.prisma.forBranch(branch.branchId).timeClockEntry.findMany({
      where: { clockInAt: { gte: start, lt: end } },
      orderBy: { clockInAt: "desc" },
      select: { id: true, staffId: true, staffShiftId: true, clockInAt: true, clockOutAt: true },
    });

    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const firstShiftByStaff = new Map<string, (typeof shifts)[number]>();
    for (const shift of shifts) {
      if (!firstShiftByStaff.has(shift.staffId)) firstShiftByStaff.set(shift.staffId, shift);
    }
    const latestEntryByStaff = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      if (!latestEntryByStaff.has(entry.staffId)) latestEntryByStaff.set(entry.staffId, entry);
    }

    const staffIds = new Set<string>([...firstShiftByStaff.keys(), ...latestEntryByStaff.keys()]);
    const staffRecords = await this.prisma.forBranch(branch.branchId).staffProfile.findMany({
      where: { id: { in: [...staffIds] } },
      select: { id: true, name: true, level: true },
    });
    const staffById = new Map(staffRecords.map((s) => [s.id, s]));

    let rows = [...staffIds].map((staffId) => {
      const entry = latestEntryByStaff.get(staffId) ?? null;
      const matchedShift =
        (entry?.staffShiftId ? shiftById.get(entry.staffShiftId) : undefined) ??
        firstShiftByStaff.get(staffId) ??
        null;

      const attendance = evaluateAttendance({
        shiftStartMin: matchedShift?.startMin ?? null,
        shiftEndMin: matchedShift?.endMin ?? null,
        clockInMinuteOfDay: entry ? bangkokMinuteOfDay(entry.clockInAt) : null,
        clockOutMinuteOfDay: entry?.clockOutAt ? bangkokMinuteOfDay(entry.clockOutAt) : null,
      });

      return {
        staffId,
        staff: staffById.get(staffId) ?? null,
        shift: matchedShift ? { startMin: matchedShift.startMin, endMin: matchedShift.endMin } : null,
        clockInAt: entry?.clockInAt ?? null,
        clockOutAt: entry?.clockOutAt ?? null,
        attendance,
      };
    });

    if (staffIdFilter) {
      rows = rows.filter((row) => row.staffId === staffIdFilter);
    }
    rows.sort((a, b) => (a.staff?.name ?? "").localeCompare(b.staff?.name ?? "", "th"));

    return rows;
  }

  private async loadActiveStaff(branchId: string, staffId: string): Promise<StaffProfile> {
    const staff = await this.prisma.client.staffProfile.findUnique({ where: { id: staffId } });
    if (!staff || staff.branchId !== branchId || !staff.isActive) {
      throw new NotFoundException("ไม่พบพนักงานนี้ หรือพนักงานถูกปิดใช้งานแล้ว");
    }
    return staff;
  }

  /**
   * ตรวจ PIN ลงเวลาของ StaffProfile — ใช้ lockout constant ร่วมกับ auth module (PIN_MAX_ATTEMPTS/
   * PIN_LOCKOUT_MS) แต่แยก method เพราะ Prisma model คนละตัวกับ verifyPin ของ AuthService (User)
   */
  private async verifyStaffPin(staff: StaffProfile, pin: string): Promise<void> {
    if (staff.pinHash === null) {
      throw new UnprocessableEntityException("พนักงานคนนี้ยังไม่ได้ตั้ง PIN");
    }
    if (staff.pinLockedUntil && staff.pinLockedUntil.getTime() > Date.now()) {
      throw new ConflictException(
        `PIN ถูกล็อกชั่วคราวจนถึง ${staff.pinLockedUntil.toISOString()} — กรอกผิดเกินกำหนด ลองใหม่ภายหลัง`,
      );
    }

    const valid = await argon2.verify(staff.pinHash, pin);
    if (!valid) {
      const attempts = staff.pinFailedAttempts + 1;
      if (attempts >= PIN_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS);
        await this.prisma.client.staffProfile.update({
          where: { id: staff.id },
          data: { pinFailedAttempts: 0, pinLockedUntil: lockedUntil },
        });
        throw new ConflictException(
          `PIN ถูกล็อกชั่วคราวจนถึง ${lockedUntil.toISOString()} — กรอกผิดเกินกำหนด ลองใหม่ภายหลัง`,
        );
      }
      await this.prisma.client.staffProfile.update({
        where: { id: staff.id },
        data: { pinFailedAttempts: attempts },
      });
      throw new UnauthorizedException(
        `PIN ไม่ถูกต้อง (เหลืออีก ${PIN_MAX_ATTEMPTS - attempts} ครั้งก่อนถูกล็อกชั่วคราว)`,
      );
    }

    await this.prisma.client.staffProfile.update({
      where: { id: staff.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });
  }
}

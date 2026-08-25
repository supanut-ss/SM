import {
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  bangkokDateKey,
  computeClockOutMetrics,
  isSameMinute,
  matchShiftForClockIn,
  minutesSinceBangkokMidnight,
  summarizeDailyShiftStatus,
  type ShiftWindow,
} from "@lotus-desk/core";
import { AuditEntity } from "../../audit/audit-entity.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard, type AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CurrentBranch } from "../rbac/current-branch.decorator";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import type { BranchContext } from "../rbac/permission.guard";

function dateOnlyFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function resolveDateKey(dateParam: string | undefined, now: Date): string {
  return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : bangkokDateKey(now);
}

/**
 * นาทีอ้างอิงสำหรับ summarizeDailyShiftStatus — วันนี้ใช้เวลาปัจจุบันจริง, วันที่ผ่านไปแล้วใช้ 1440
 * (ถือว่าจบวันแล้ว ทุกกะที่ไม่มีคนลงเวลาคือขาด), วันในอนาคตใช้ -1 (ยังไม่ถึงกะไหนเลย ทุกกะเป็น "ยังไม่ถึงเวลา")
 * เทียบด้วย string key ตรง ๆ ได้เพราะรูปแบบ "YYYY-MM-DD" เรียงตามตัวอักษรตรงกับเรียงตามวันที่พอดี
 */
function resolveNowMinutesOfDay(dateKey: string, todayKey: string, now: Date): number {
  if (dateKey < todayKey) return 1440;
  if (dateKey > todayKey) return -1;
  return minutesSinceBangkokMidnight(now);
}

/**
 * ลงเวลาทำงาน (T6.1) — nested ใต้ /branches/:branchId/attendance พนักงานที่ล็อกอินผ่าน PIN (T1.3, session
 * สั้น 8 ชม.) ใช้สิทธิ์ "attendance:manage" ของบทบาทตัวเอง (บทบาท "พนักงานบริการ" มีสิทธิ์นี้ตั้งแต่ seed
 * T1.1 อยู่แล้ว — ดู packages/contracts/src/permissions.ts) กดลงเวลาเข้า/ออกงานของตัวเองได้เลย ไม่ต้องมี
 * one-off PIN แยกต่างหากเหมือน verifyManagerPin (T5.6) เพราะ session ที่ล็อกอินอยู่แล้วระบุตัวตนได้ชัดเจน
 * อยู่แล้วผ่าน JwtAuthGuard — ดู docs/decisions.md
 *
 * ไม่มีค่าปรับหักเงินจากสาย/ขาด (docs/DOMAIN.md ข้อ 13) — lateMinutes/otMinutes/earlyLeaveMinutes เก็บไว้
 * เพื่อรายงาน/ตักเตือนเท่านั้น คำนวณผ่าน packages/core/attendance (pure function, unit test แยกต่างหาก)
 * "me"/"clock-in"/"clock-out" ใช้สิทธิ์ "manage" (ไม่ใช่ "view") เพราะเป็น flow ลงเวลาของตัวเอง ตรงกับสิทธิ์
 * ที่บทบาท "พนักงานบริการ" มีอยู่แล้ว ส่วน list/summary ใช้ "view" — บทบาท "พนักงานบริการ" เห็นได้ด้วยเพราะ
 * "manage" ครอบคลุม "view" ในตัวเสมอ (ดู ability.factory.ts: "จัดการได้ย่อมดูได้") ไม่ได้ตั้งใจกันพนักงาน
 * ออกจากรายงานภาพรวม แค่แยกสิทธิ์ตามความหมายของ action ให้ตรงธรรมเนียมเดียวกับ endpoint อื่นทั้งระบบ
 */
@Controller("branches/:branchId/attendance")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("view", "attendance")
  async list(
    @CurrentBranch() branch: BranchContext,
    @Query("staffId") staffId?: string,
    @Query("date") date?: string,
  ) {
    const dateKey = resolveDateKey(date, new Date());
    return this.prisma.forBranch(branch.branchId).attendanceRecord.findMany({
      where: {
        date: dateOnlyFromKey(dateKey),
        ...(staffId ? { staffId } : {}),
      },
      include: { staff: true, staffShift: true },
      orderBy: [{ clockInAt: "desc" }],
    });
  }

  /**
   * สรุปสถานะรายกะของทุกคนในวันนั้น (สาย/ขาด/กำลังทำงาน/ยังไม่ถึงเวลา) — ใช้ทำรายงานตาม docs/DOMAIN.md
   * ข้อ 13 ("T6.1 ยังต้องคำนวณสาย/ขาด/OT เพื่อรายงาน แต่ไม่หักเงิน")
   */
  @Get("summary")
  @RequirePermission("view", "attendance")
  async summary(@CurrentBranch() branch: BranchContext, @Query("date") date?: string) {
    const now = new Date();
    const dateKey = resolveDateKey(date, now);
    const dateOnly = dateOnlyFromKey(dateKey);
    const nowMinutesOfDay = resolveNowMinutesOfDay(dateKey, bangkokDateKey(now), now);

    const shiftsToday = await this.prisma.forBranch(branch.branchId).staffShift.findMany({
      where: { date: dateOnly },
      include: { staff: true },
      orderBy: [{ startMin: "asc" }],
    });

    const attendanceRows = await this.prisma.forBranch(branch.branchId).attendanceRecord.findMany({
      where: { date: dateOnly, staffShiftId: { not: null } },
    });
    const attendanceByShiftId = Object.fromEntries(
      attendanceRows.map((r) => [r.staffShiftId as string, { clockInAt: r.clockInAt, clockOutAt: r.clockOutAt }]),
    );

    const shiftWindows: ShiftWindow[] = shiftsToday.map((s) => ({
      id: s.id,
      startMin: s.startMin,
      endMin: s.endMin,
    }));
    const statuses = summarizeDailyShiftStatus({
      shiftsToday: shiftWindows,
      attendanceByShiftId,
      nowMinutesOfDay,
    });
    const statusByShiftId = new Map(statuses.map((s) => [s.shiftId, s.status]));

    return shiftsToday.map((s) => ({
      staffShiftId: s.id,
      staffId: s.staffId,
      staffName: s.staff.name,
      startMin: s.startMin,
      endMin: s.endMin,
      status: statusByShiftId.get(s.id)!,
    }));
  }

  /** สถานะลงเวลาของ "ฉัน" (ผู้ใช้ที่ล็อกอินอยู่ตอนนี้) — UI ใช้ตัดสินใจว่าจะโชว์ปุ่ม "เข้างาน" หรือ "ออกงาน" */
  @Get("me")
  @RequirePermission("manage", "attendance")
  async me(@CurrentBranch() branch: BranchContext, @CurrentUser() user: AuthenticatedUser) {
    const staff = await this.prisma.client.staffProfile.findUnique({ where: { userId: user.sub } });
    if (!staff || staff.branchId !== branch.branchId || !staff.isActive) {
      return { staffId: null, staffName: null, openRecord: null };
    }
    const openRecord = await this.prisma.client.attendanceRecord.findFirst({
      where: { staffId: staff.id, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
      include: { staffShift: true },
    });
    return { staffId: staff.id, staffName: staff.name, openRecord };
  }

  @Post("clock-in")
  @RequirePermission("manage", "attendance")
  @AuditEntity("AttendanceRecord")
  async clockIn(@CurrentBranch() branch: BranchContext, @CurrentUser() user: AuthenticatedUser) {
    const staff = await this.resolveActiveStaff(branch.branchId, user.sub);
    const now = new Date();

    await this.assertNotDuplicateClockAction(staff.id, now);

    const openRecord = await this.prisma.client.attendanceRecord.findFirst({
      where: { staffId: staff.id, clockOutAt: null },
    });
    if (openRecord) {
      throw new ConflictException("มีรอบลงเวลาที่ยังไม่ปิดอยู่ กรุณาลงเวลาออกก่อนลงเวลาเข้างานใหม่");
    }

    const dateKey = bangkokDateKey(now);
    const dateOnly = dateOnlyFromKey(dateKey);
    const localMinutes = minutesSinceBangkokMidnight(now);

    const shiftsToday = await this.prisma.client.staffShift.findMany({
      where: { staffId: staff.id, date: dateOnly },
    });
    const claimedRows = await this.prisma.client.attendanceRecord.findMany({
      where: { staffId: staff.id, date: dateOnly, staffShiftId: { not: null } },
      select: { staffShiftId: true },
    });

    const shiftWindows: ShiftWindow[] = shiftsToday.map((s) => ({
      id: s.id,
      startMin: s.startMin,
      endMin: s.endMin,
    }));
    const { matchedShift, lateMinutes } = matchShiftForClockIn({
      localMinutes,
      shiftsToday: shiftWindows,
      claimedShiftIds: claimedRows.map((r) => r.staffShiftId!),
    });

    return this.prisma.client.attendanceRecord.create({
      data: {
        branchId: branch.branchId,
        staffId: staff.id,
        date: dateOnly,
        staffShiftId: matchedShift?.id ?? null,
        clockInAt: now,
        lateMinutes,
      },
      include: { staffShift: true },
    });
  }

  @Post("clock-out")
  @RequirePermission("manage", "attendance")
  @AuditEntity("AttendanceRecord")
  async clockOut(@CurrentBranch() branch: BranchContext, @CurrentUser() user: AuthenticatedUser) {
    const staff = await this.resolveActiveStaff(branch.branchId, user.sub);
    const now = new Date();

    await this.assertNotDuplicateClockAction(staff.id, now);

    const openRecord = await this.prisma.client.attendanceRecord.findFirst({
      where: { staffId: staff.id, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });
    if (!openRecord) {
      throw new ConflictException("ยังไม่ได้ลงเวลาเข้างาน กรุณาลงเวลาเข้างานก่อน");
    }

    const localMinutes = minutesSinceBangkokMidnight(now);
    let shift: ShiftWindow | null = null;
    if (openRecord.staffShiftId) {
      const staffShift = await this.prisma.client.staffShift.findUnique({
        where: { id: openRecord.staffShiftId },
      });
      if (staffShift) {
        shift = { id: staffShift.id, startMin: staffShift.startMin, endMin: staffShift.endMin };
      }
    }
    const { otMinutes, earlyLeaveMinutes } = computeClockOutMetrics({ localMinutes, shift });

    return this.prisma.client.attendanceRecord.update({
      where: { id: openRecord.id },
      data: { clockOutAt: now, otMinutes, earlyLeaveMinutes },
      include: { staffShift: true },
    });
  }

  /** บัญชีที่ล็อกอินอยู่ต้องผูกกับ StaffProfile ที่ยังทำงานอยู่ในสาขานี้เท่านั้นถึงจะลงเวลาได้ (ดู T6.1 schema) */
  private async resolveActiveStaff(branchId: string, userId: string) {
    const staff = await this.prisma.client.staffProfile.findUnique({ where: { userId } });
    if (!staff || staff.branchId !== branchId || !staff.isActive) {
      throw new UnprocessableEntityException(
        "บัญชีนี้ไม่ได้ผูกกับพนักงานที่ใช้งานอยู่ในสาขานี้ — กรุณาติดต่อผู้จัดการให้ผูกบัญชีก่อนลงเวลา",
      );
    }
    return staff;
  }

  /**
   * เกณฑ์ผ่านหลักของ T6.1: "ลงเวลาซ้ำในนาทีเดียวกันต้องถูกปฏิเสธ" — กันพนักงานกดปุ่มซ้ำเร็ว ๆ (double-tap)
   * เทียบกับเหตุการณ์ล่าสุดของพนักงานคนนี้เท่านั้น (เข้าล่าสุดถ้ารอบยังเปิดอยู่ ออกล่าสุดถ้ารอบปิดไปแล้ว) —
   * เรียงตาม clockInAt เพียงพอเพราะ record ใหม่ถูกสร้างได้ก็ต่อเมื่อ record ก่อนหน้าถูกปิดแล้วเท่านั้น (ดู
   * guard "มีรอบลงเวลาที่ยังไม่ปิดอยู่" ใน clockIn) ลำดับ clockInAt จึงตรงกับลำดับเหตุการณ์จริงเสมอ
   */
  private async assertNotDuplicateClockAction(staffId: string, now: Date): Promise<void> {
    const latest = await this.prisma.client.attendanceRecord.findFirst({
      where: { staffId },
      orderBy: { clockInAt: "desc" },
    });
    if (!latest) return;
    const lastEventAt = latest.clockOutAt ?? latest.clockInAt;
    if (isSameMinute(lastEventAt, now)) {
      throw new ConflictException("ลงเวลาซ้ำในนาทีเดียวกัน กรุณารอสักครู่แล้วลองใหม่");
    }
  }
}

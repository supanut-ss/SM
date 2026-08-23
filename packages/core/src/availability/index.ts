// หาช่องว่างพนักงาน × ห้อง × กะ — pure function เท่านั้น ห้าม import Prisma/Nest/React/fetch
// เวลาปัจจุบันรับเป็น parameter เสมอ (ห้ามเรียก Date.now() ตรง ๆ) — ดู docs/PLAN.md T4.1 (§5, §7.2)
export type {
  AvailableSlot,
  BookedBlock,
  FindAvailableSlotsInput,
  Room,
  ServiceVariant,
  StaffLeave,
  StaffLevel,
  StaffProfile,
  StaffShift,
  StaffSkill,
} from "./types.js";

import type { AvailableSlot, BookedBlock, FindAvailableSlotsInput } from "./types.js";

/** ทับกันแบบ half-open interval — ชนกันพอดีที่ปลาย (aEnd === bStart) ไม่ถือว่าทับ */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * ปัดเวลาขึ้นไปยังจุดกริดถัดไป (นาทีที่หารด้วย stepMs ลงตัว) — คำนวณบน epoch UTC ตรง ๆ โดยไม่ต้องแปลง
 * เป็นเวลาไทยก่อน เพราะ Bangkok = UTC+7 และ 7 ชั่วโมง (420 นาที) หารลงตัวด้วยทุกความละเอียดที่ใช้จริง
 * (15/30/60 นาที) กริดที่ปัดบน UTC epoch จึงตรงกับกริดนาฬิกาไทยเป๊ะเสมอ ไม่ต้องรู้จัก timezone เลย
 */
function ceilToGrid(time: Date, stepMs: number): Date {
  const ms = time.getTime();
  const remainder = ms % stepMs;
  return remainder === 0 ? time : new Date(ms + (stepMs - remainder));
}

export function findAvailableSlots(input: FindAvailableSlotsInput): AvailableSlot[] {
  const { now, shifts, leaves, existing, staff, rooms, service, granularityMin, preferredStaffId } = input;

  const staffOnLeave = new Set(leaves.map((l) => l.staffId));
  const eligibleStaff = staff.filter(
    (s) =>
      s.skills.includes(service.requiredSkill) &&
      !staffOnLeave.has(s.id) &&
      (preferredStaffId === undefined || s.id === preferredStaffId),
  );
  const eligibleRooms = rooms.filter((r) => r.roomTypeId === service.requiredRoomTypeId);

  if (eligibleStaff.length === 0 || eligibleRooms.length === 0) return [];

  const durationMs = service.durationMin * 60_000;
  const bufferBeforeMs = service.bufferBeforeMin * 60_000;
  const bufferAfterMs = service.bufferAfterMin * 60_000;
  const stepMs = granularityMin * 60_000;

  const slots: AvailableSlot[] = [];

  for (const s of eligibleStaff) {
    const staffShifts = shifts.filter((sh) => sh.staffId === s.id);

    for (const shift of staffShifts) {
      let start = ceilToGrid(shift.start, stepMs);

      while (start.getTime() + durationMs <= shift.end.getTime()) {
        if (start.getTime() < now.getTime()) {
          start = new Date(start.getTime() + stepMs);
          continue;
        }

        const end = new Date(start.getTime() + durationMs);
        const paddedStart = new Date(start.getTime() - bufferBeforeMs);
        const paddedEnd = new Date(end.getTime() + bufferAfterMs);

        const staffBusy = existing.some(
          (b) => b.staffId === s.id && overlaps(paddedStart, paddedEnd, b.start, b.end),
        );

        if (!staffBusy) {
          for (const room of eligibleRooms) {
            const concurrent = countOverlapping(existing, room.id, paddedStart, paddedEnd);
            if (concurrent < room.capacity) {
              slots.push({ start, end, staffId: s.id, roomId: room.id });
            }
          }
        }

        start = new Date(start.getTime() + stepMs);
      }
    }
  }

  return slots;
}

function countOverlapping(existing: BookedBlock[], roomId: string, start: Date, end: Date): number {
  let count = 0;
  for (const b of existing) {
    if (b.roomId === roomId && overlaps(start, end, b.start, b.end)) count++;
  }
  return count;
}

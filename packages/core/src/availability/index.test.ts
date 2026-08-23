import { describe, expect, it } from "vitest";
import { findAvailableSlots } from "./index.js";
import type {
  BookedBlock,
  FindAvailableSlotsInput,
  Room,
  ServiceVariant,
  StaffLeave,
  StaffProfile,
  StaffShift,
} from "./types.js";

// วันฐานที่ใช้ทดสอบทั้งไฟล์: 2026-08-24 — Bangkok = UTC+7 เสมอ (ไทยไม่มี DST)
// bkk(9, 0) = เวลา 09:00 ตามนาฬิกาไทยของวันฐาน (หรือวัน + dayOffset) แปลงเป็น Date UTC จริงให้เอง
const BASE_DAY = 24;
function bkk(hh: number, mm: number, dayOffset = 0): Date {
  return new Date(Date.UTC(2026, 7, BASE_DAY + dayOffset, hh - 7, mm, 0, 0));
}

const THAI_MASSAGE_ROOM_TYPE = "room-type-thai";

function staff(id: string, overrides: Partial<StaffProfile> = {}): StaffProfile {
  return { id, skills: ["THAI_MASSAGE"], level: "JUNIOR", ...overrides };
}

function room(id: string, overrides: Partial<Room> = {}): Room {
  return { id, roomTypeId: THAI_MASSAGE_ROOM_TYPE, capacity: 1, ...overrides };
}

function shift(staffId: string, startHH: number, endHH: number, dayOffset = 0): StaffShift {
  return { staffId, start: bkk(startHH, 0, dayOffset), end: bkk(endHH, 0, dayOffset) };
}

function service(overrides: Partial<ServiceVariant> = {}): ServiceVariant {
  return {
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    requiredSkill: "THAI_MASSAGE",
    requiredRoomTypeId: THAI_MASSAGE_ROOM_TYPE,
    ...overrides,
  };
}

function baseInput(overrides: Partial<FindAvailableSlotsInput> = {}): FindAvailableSlotsInput {
  return {
    now: bkk(0, 0),
    date: bkk(0, 0),
    shifts: [shift("staff-1", 9, 18)],
    leaves: [],
    existing: [],
    staff: [staff("staff-1")],
    rooms: [room("room-1")],
    service: service(),
    granularityMin: 30,
    ...overrides,
  };
}

function startsAt(slots: ReturnType<typeof findAvailableSlots>, time: Date): boolean {
  return slots.some((s) => s.start.getTime() === time.getTime());
}

describe("findAvailableSlots", () => {
  it("คืนช่องว่างพื้นฐานได้เมื่อไม่มีนัดอื่นเลย", () => {
    const slots = findAvailableSlots(baseInput());
    expect(startsAt(slots, bkk(9, 0))).toBe(true);
    expect(startsAt(slots, bkk(17, 0))).toBe(true); // 17:00-18:00 พอดีจบเวลาเลิกกะ
  });

  it("ชนหัว: นัดเดิมทับช่วงต้นของช่วงที่จะจอง ต้องไม่เสนอช่อง", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-1", start: bkk(8, 30), end: bkk(9, 30) }];
    const slots = findAvailableSlots(baseInput({ existing }));
    expect(startsAt(slots, bkk(9, 0))).toBe(false);
  });

  it("ชนท้าย: นัดเดิมทับช่วงท้ายของช่วงที่จะจอง ต้องไม่เสนอช่อง", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-1", start: bkk(9, 30), end: bkk(10, 30) }];
    const slots = findAvailableSlots(baseInput({ existing }));
    expect(startsAt(slots, bkk(9, 0))).toBe(false);
  });

  it("คร่อมทั้งงาน: นัดเดิมครอบช่วงที่จะจองทั้งหมด ต้องไม่เสนอช่อง", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-1", start: bkk(8, 0), end: bkk(11, 0) }];
    const slots = findAvailableSlots(baseInput({ existing }));
    expect(startsAt(slots, bkk(9, 0))).toBe(false);
  });

  it("จบพอดีกับที่อีกงานเริ่ม: ไม่มี buffer ต้องจองได้ (ชนกันพอดีไม่นับว่าทับ)", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-1", start: bkk(10, 0), end: bkk(11, 0) }];
    const slots = findAvailableSlots(baseInput({ existing }));
    expect(startsAt(slots, bkk(9, 0))).toBe(true); // 09:00-10:00 ชนพอดีกับนัดที่เริ่ม 10:00
  });

  it("buffer ทับกัน: มี bufferAfter แล้วชนกับนัดถัดไป ต้องไม่เสนอช่อง", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-1", start: bkk(10, 0), end: bkk(11, 0) }];
    const slots = findAvailableSlots(
      baseInput({ existing, service: service({ bufferAfterMin: 15 }) }),
    );
    expect(startsAt(slots, bkk(9, 0))).toBe(false); // 09:00-10:00 + buffer 15 นาที ยื่นไปชน 10:00
  });

  it("bufferBefore ก็ต้องกันชนกับนัดก่อนหน้าเหมือนกัน", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-1", start: bkk(8, 0), end: bkk(9, 0) }];
    const slots = findAvailableSlots(
      baseInput({ existing, service: service({ bufferBeforeMin: 15 }) }),
    );
    expect(startsAt(slots, bkk(9, 0))).toBe(false); // buffer ก่อน 15 นาที ยื่นย้อนไปชนนัด 08:00-09:00
  });

  it("นอกกะ: เวลาที่กะยังไม่เริ่ม ต้องไม่มีช่องว่าง", () => {
    const slots = findAvailableSlots(baseInput({ now: bkk(0, 0) }));
    expect(startsAt(slots, bkk(8, 0))).toBe(false); // กะเริ่ม 09:00
  });

  it("คร่อมขอบกะ: ช่วงที่จะจองเลยเวลาเลิกกะ ต้องไม่เสนอช่อง แต่ช่วงที่พอดีขอบกะต้องเสนอ", () => {
    const input = baseInput({
      shifts: [{ staffId: "staff-1", start: bkk(9, 0), end: bkk(10, 30) }],
      granularityMin: 15,
    });
    const slots = findAvailableSlots(input);
    expect(startsAt(slots, bkk(9, 30))).toBe(true); // 09:30-10:30 พอดีจบที่ขอบกะ
    expect(startsAt(slots, bkk(9, 45))).toBe(false); // 09:45-10:45 เลยขอบกะ
  });

  it("วันลา: พนักงานที่ลาวันนั้นต้องไม่มีช่องว่างเลย แต่คนอื่นยังปกติ", () => {
    const leaves: StaffLeave[] = [{ staffId: "staff-1" }];
    const input = baseInput({
      leaves,
      staff: [staff("staff-1"), staff("staff-2")],
      shifts: [shift("staff-1", 9, 18), shift("staff-2", 9, 18)],
    });
    const slots = findAvailableSlots(input);
    expect(slots.some((s) => s.staffId === "staff-1")).toBe(false);
    expect(slots.some((s) => s.staffId === "staff-2")).toBe(true);
  });

  it("กะแบ่งครึ่ง (พักเที่ยง): ช่วงที่คร่อมพักเที่ยงต้องไม่เสนอ แต่แต่ละครึ่งยังจองได้ปกติ", () => {
    const input = baseInput({
      shifts: [
        { staffId: "staff-1", start: bkk(9, 0), end: bkk(12, 0) },
        { staffId: "staff-1", start: bkk(13, 0), end: bkk(18, 0) },
      ],
    });
    const slots = findAvailableSlots(input);
    expect(startsAt(slots, bkk(11, 0))).toBe(true); // 11:00-12:00 อยู่ในกะเช้าพอดี
    expect(startsAt(slots, bkk(13, 0))).toBe(true); // 13:00-14:00 อยู่ในกะบ่าย
    expect(startsAt(slots, bkk(11, 30))).toBe(false); // 11:30-12:30 คร่อมช่วงพักเที่ยง ไม่มีกะไหนครอบคลุมทั้งหมด
  });

  it("พนักงานไม่มีทักษะที่ต้องใช้ ต้องไม่มีช่องว่างเลย", () => {
    const input = baseInput({ staff: [staff("staff-1", { skills: ["OIL"] })] });
    expect(findAvailableSlots(input)).toHaveLength(0);
  });

  it("ห้องผิดประเภท ต้องไม่มีช่องว่างเลย", () => {
    const input = baseInput({ rooms: [room("room-1", { roomTypeId: "room-type-nail" })] });
    expect(findAvailableSlots(input)).toHaveLength(0);
  });

  it("ห้องเต็ม capacity (1) ต้องไม่เสนอช่องซ้อนเวลาเดียวกัน", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-2", roomId: "room-1", start: bkk(9, 0), end: bkk(10, 0) }];
    const input = baseInput({
      existing,
      staff: [staff("staff-1")],
      rooms: [room("room-1", { capacity: 1 })],
    });
    expect(startsAt(findAvailableSlots(input), bkk(9, 0))).toBe(false);
  });

  it("ห้อง capacity มากกว่า 1 ยังจองพร้อมกันได้ในเวลาเดียวกัน", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-2", roomId: "room-1", start: bkk(9, 0), end: bkk(10, 0) }];
    const input = baseInput({
      existing,
      staff: [staff("staff-1")],
      rooms: [room("room-1", { capacity: 2 })],
    });
    expect(startsAt(findAvailableSlots(input), bkk(9, 0))).toBe(true);
  });

  it("ไม่มีห้องว่างแต่คนว่าง: ห้องเดียวถูกจองเต็มทั้งกะ ต้องไม่มีช่องว่างเลยแม้พนักงานจะว่างทั้งวัน", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-2", roomId: "room-1", start: bkk(9, 0), end: bkk(18, 0) }];
    const input = baseInput({ existing });
    expect(findAvailableSlots(input)).toHaveLength(0);
  });

  it("ไม่มีคนว่างแต่ห้องว่าง: พนักงานถูกจองเต็มทั้งกะ ต้องไม่มีช่องว่างเลยแม้ห้องจะว่างทั้งวัน", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-1", roomId: "room-2", start: bkk(9, 0), end: bkk(18, 0) }];
    const input = baseInput({ existing });
    expect(findAvailableSlots(input)).toHaveLength(0);
  });

  it("เวลาที่ผ่านไปแล้วต้องไม่ถูกเสนอ แต่เวลาที่ยังไม่ถึงยังเสนอปกติ", () => {
    const input = baseInput({ now: bkk(10, 0) });
    const slots = findAvailableSlots(input);
    expect(startsAt(slots, bkk(9, 0))).toBe(false);
    expect(startsAt(slots, bkk(9, 30))).toBe(false);
    expect(startsAt(slots, bkk(10, 0))).toBe(true);
  });

  it("เริ่มพอดีตอน now ต้องนับว่าจองได้ (ไม่ใช่แค่หลัง now เท่านั้น)", () => {
    const input = baseInput({ now: bkk(9, 0) });
    expect(startsAt(findAvailableSlots(input), bkk(9, 0))).toBe(true);
  });

  it("granularity 15 ให้ช่องถี่กว่า granularity 30 ที่เงื่อนไขเดียวกัน", () => {
    const input15 = baseInput({ granularityMin: 15 });
    const input30 = baseInput({ granularityMin: 30 });
    const slots15 = findAvailableSlots(input15);
    const slots30 = findAvailableSlots(input30);
    expect(slots15.length).toBeGreaterThan(slots30.length);
    expect(startsAt(slots15, bkk(9, 15))).toBe(true);
    expect(startsAt(slots30, bkk(9, 15))).toBe(false);
  });

  it("ข้ามเที่ยงคืน (ร้านปิด 02:00): กะที่คร่อมเที่ยงคืนต้องหาช่องได้ถูกต้อง", () => {
    const input = baseInput({
      now: bkk(20, 0),
      shifts: [{ staffId: "staff-1", start: bkk(20, 0), end: bkk(2, 0, 1) }],
    });
    const slots = findAvailableSlots(input);
    expect(startsAt(slots, bkk(1, 0, 1))).toBe(true); // 01:00-02:00 (วันถัดไป) พอดีจบก่อนร้านปิด
    expect(startsAt(slots, bkk(1, 30, 1))).toBe(false); // 01:30-02:30 เลยเวลาปิด
  });

  it("timezone offset: กริดคำนวณบน UTC ตรง ๆ ต้องตรงกับเวลาไทยเป๊ะ ไม่มีการเลื่อนเวลาผิดพลาด", () => {
    const input = baseInput();
    const slots = findAvailableSlots(input);
    const nineAm = slots.find((s) => s.staffId === "staff-1" && s.roomId === "room-1" && s.start.getTime() === bkk(9, 0).getTime());
    expect(nineAm).toBeDefined();
    expect(nineAm!.start.toISOString()).toBe("2026-08-24T02:00:00.000Z"); // 09:00 ไทย = 02:00 UTC
  });

  it("preferredStaffId: ระบุแล้วต้องคืนเฉพาะพนักงานคนนั้น", () => {
    const input = baseInput({
      staff: [staff("staff-1"), staff("staff-2")],
      shifts: [shift("staff-1", 9, 18), shift("staff-2", 9, 18)],
      preferredStaffId: "staff-2",
    });
    const slots = findAvailableSlots(input);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.staffId === "staff-2")).toBe(true);
  });

  it("ไม่มีพนักงานเลยต้องคืนอาเรย์ว่าง", () => {
    expect(findAvailableSlots(baseInput({ staff: [] }))).toHaveLength(0);
  });

  it("ไม่มีห้องเลยต้องคืนอาเรย์ว่าง", () => {
    expect(findAvailableSlots(baseInput({ rooms: [] }))).toHaveLength(0);
  });

  it("หลายพนักงาน+หลายห้อง ต้องคืนครบทุกคู่ที่ถูกต้องในเวลาเดียวกัน", () => {
    const input = baseInput({
      staff: [staff("staff-1"), staff("staff-2")],
      shifts: [shift("staff-1", 9, 18), shift("staff-2", 9, 18)],
      rooms: [room("room-1"), room("room-2")],
    });
    const slots = findAvailableSlots(input).filter((s) => s.start.getTime() === bkk(9, 0).getTime());
    expect(slots).toHaveLength(4); // 2 พนักงาน × 2 ห้อง
  });

  it("กะพอดีกับระยะเวลาบริการเป๊ะ ต้องมีช่องเดียวที่เริ่มพอดีต้นกะ", () => {
    const input = baseInput({
      shifts: [{ staffId: "staff-1", start: bkk(9, 0), end: bkk(10, 0) }],
      service: service({ durationMin: 60 }),
      granularityMin: 30,
    });
    const slots = findAvailableSlots(input);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.start.getTime()).toBe(bkk(9, 0).getTime());
  });

  it("นัดของพนักงาน/ห้องอื่นที่ไม่เกี่ยวข้องต้องไม่กระทบช่องว่างที่หาอยู่", () => {
    const existing: BookedBlock[] = [{ staffId: "staff-2", roomId: "room-2", start: bkk(9, 0), end: bkk(10, 0) }];
    const input = baseInput({ existing });
    expect(startsAt(findAvailableSlots(input), bkk(9, 0))).toBe(true);
  });

  it("กะเริ่มเวลาที่ไม่ตรงกริด ต้องปัดขึ้นไปยังจุดกริดถัดไป ไม่เสนอเวลาที่ไม่ตรงกริด", () => {
    const input = baseInput({
      shifts: [{ staffId: "staff-1", start: new Date(bkk(9, 0).getTime() + 7 * 60_000), end: bkk(18, 0) }],
      granularityMin: 15,
    });
    const slots = findAvailableSlots(input);
    expect(startsAt(slots, new Date(bkk(9, 0).getTime() + 7 * 60_000))).toBe(false); // 09:07 ไม่ตรงกริด
    expect(startsAt(slots, bkk(9, 15))).toBe(true); // ปัดขึ้นไปยัง 09:15
  });

  it("ระยะเวลาบริการยาวกว่ากะที่มีทั้งหมด ต้องไม่มีช่องว่างเลย", () => {
    const input = baseInput({
      shifts: [{ staffId: "staff-1", start: bkk(9, 0), end: bkk(9, 30) }],
      service: service({ durationMin: 60 }),
    });
    expect(findAvailableSlots(input)).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  ADVANCE_BOOKING_MAX_DAYS,
  APPOINTMENT_STATUSES,
  ASSIGN_TYPES,
  canTransitionAppointmentStatus,
  createAdvanceAppointmentSchema,
  createWalkInAppointmentSchema,
  joinStaffQueueSchema,
  nextAppointmentStatuses,
  rescheduleAppointmentItemSchema,
  updateAppointmentItemStatusSchema,
  type AppointmentStatus,
} from "./booking.js";

describe("canTransitionAppointmentStatus", () => {
  it("อนุญาตเส้นทางหลัก BOOKED → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED", () => {
    expect(canTransitionAppointmentStatus("BOOKED", "CONFIRMED")).toBe(true);
    expect(canTransitionAppointmentStatus("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransitionAppointmentStatus("CHECKED_IN", "IN_SERVICE")).toBe(true);
    expect(canTransitionAppointmentStatus("IN_SERVICE", "COMPLETED")).toBe(true);
  });

  it("อนุญาตลัด BOOKED → CHECKED_IN ตรง ๆ สำหรับ walk-in", () => {
    expect(canTransitionAppointmentStatus("BOOKED", "CHECKED_IN")).toBe(true);
  });

  it("อนุญาตยกเลิก/ไม่มา จาก BOOKED และ CONFIRMED", () => {
    expect(canTransitionAppointmentStatus("BOOKED", "CANCELLED")).toBe(true);
    expect(canTransitionAppointmentStatus("BOOKED", "NO_SHOW")).toBe(true);
    expect(canTransitionAppointmentStatus("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransitionAppointmentStatus("CONFIRMED", "NO_SHOW")).toBe(true);
  });

  it("ห้ามยกเลิก/ไม่มา หลังเช็คอินแล้ว", () => {
    expect(canTransitionAppointmentStatus("CHECKED_IN", "CANCELLED")).toBe(false);
    expect(canTransitionAppointmentStatus("CHECKED_IN", "NO_SHOW")).toBe(false);
    expect(canTransitionAppointmentStatus("IN_SERVICE", "CANCELLED")).toBe(false);
    expect(canTransitionAppointmentStatus("IN_SERVICE", "NO_SHOW")).toBe(false);
  });

  it("ห้ามข้ามลำดับ (เช่น BOOKED → IN_SERVICE, CONFIRMED → COMPLETED)", () => {
    expect(canTransitionAppointmentStatus("BOOKED", "IN_SERVICE")).toBe(false);
    expect(canTransitionAppointmentStatus("BOOKED", "COMPLETED")).toBe(false);
    expect(canTransitionAppointmentStatus("CONFIRMED", "IN_SERVICE")).toBe(false);
    expect(canTransitionAppointmentStatus("CONFIRMED", "COMPLETED")).toBe(false);
    expect(canTransitionAppointmentStatus("CHECKED_IN", "COMPLETED")).toBe(false);
  });

  it("ห้ามย้อนสถานะกลับ (เช่น CHECKED_IN → BOOKED, COMPLETED → IN_SERVICE)", () => {
    expect(canTransitionAppointmentStatus("CHECKED_IN", "BOOKED")).toBe(false);
    expect(canTransitionAppointmentStatus("CHECKED_IN", "CONFIRMED")).toBe(false);
    expect(canTransitionAppointmentStatus("IN_SERVICE", "CHECKED_IN")).toBe(false);
    expect(canTransitionAppointmentStatus("COMPLETED", "IN_SERVICE")).toBe(false);
  });

  it("สถานะปลายทาง (COMPLETED/NO_SHOW/CANCELLED) ไปต่อไม่ได้อีกเลยไม่ว่าจะเป็นสถานะไหน", () => {
    const terminal: AppointmentStatus[] = ["COMPLETED", "NO_SHOW", "CANCELLED"];
    for (const from of terminal) {
      for (const to of APPOINTMENT_STATUSES) {
        expect(canTransitionAppointmentStatus(from, to)).toBe(false);
      }
    }
  });

  it("ห้ามอยู่ในสถานะเดิม (self-transition ไม่ใช่การเปลี่ยนสถานะ)", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(canTransitionAppointmentStatus(status, status)).toBe(false);
    }
  });
});

describe("nextAppointmentStatuses", () => {
  it("คืนรายการที่ตรงกับ canTransitionAppointmentStatus เสมอ", () => {
    for (const from of APPOINTMENT_STATUSES) {
      const next = nextAppointmentStatuses(from);
      for (const to of APPOINTMENT_STATUSES) {
        expect(next.includes(to)).toBe(canTransitionAppointmentStatus(from, to));
      }
    }
  });
});

describe("updateAppointmentItemStatusSchema", () => {
  it("ยอมรับสถานะที่ถูกต้อง", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({ status: "CONFIRMED" });
    expect(result.success).toBe(true);
  });

  it("ปฏิเสธสถานะที่ไม่มีอยู่จริง", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({ status: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("ปฏิเสธเมื่อไม่ส่ง status มา", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("ปฏิเสธการเปลี่ยนเป็น IN_SERVICE โดยไม่ระบุแหล่งชำระ (ADR-046 — ตัดสินใจตอนเริ่มงาน)", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({ status: "IN_SERVICE" });
    expect(result.success).toBe(false);
  });

  it("ยอมรับการเปลี่ยนเป็น IN_SERVICE เมื่อระบุแหล่งชำระที่ไม่ใช่ PACKAGE มาด้วย", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({
      status: "IN_SERVICE",
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(true);
  });

  it("ปฏิเสธการเปลี่ยนเป็น IN_SERVICE ด้วยแหล่งชำระ PACKAGE โดยไม่ระบุ memberPackageId", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({
      status: "IN_SERVICE",
      paymentMethod: "PACKAGE",
    });
    expect(result.success).toBe(false);
  });

  it("ยอมรับการเปลี่ยนเป็น IN_SERVICE ด้วยแหล่งชำระ PACKAGE เมื่อระบุ memberPackageId มาด้วย", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({
      status: "IN_SERVICE",
      paymentMethod: "PACKAGE",
      memberPackageId: "mp_1",
    });
    expect(result.success).toBe(true);
  });

  it("ไม่บังคับ/ไม่ต้องการแหล่งชำระสำหรับ COMPLETED อีกต่อไป", () => {
    const result = updateAppointmentItemStatusSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(true);
  });
});

describe("joinStaffQueueSchema", () => {
  it("ยอมรับ staffId อย่างเดียวโดยไม่ต้องมี date", () => {
    const result = joinStaffQueueSchema.safeParse({ staffId: "staff_1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.date).toBeUndefined();
  });

  it("ยอมรับ date ที่ระบุมาด้วย", () => {
    const result = joinStaffQueueSchema.safeParse({ staffId: "staff_1", date: "2026-09-01" });
    expect(result.success).toBe(true);
  });

  it("ปฏิเสธเมื่อไม่ส่ง staffId มา", () => {
    const result = joinStaffQueueSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("ASSIGN_TYPES มีค่าครบ 2 แบบ", () => {
    expect(ASSIGN_TYPES).toEqual(["ROTATION", "CUSTOMER_REQUEST"]);
  });
});

describe("rescheduleAppointmentItemSchema", () => {
  it("ยอมรับข้อมูลที่ถูกต้องครบ", () => {
    const result = rescheduleAppointmentItemSchema.safeParse({
      staffId: "staff_1",
      roomId: "room_1",
      startAt: "2026-09-01T09:00:00.000Z",
      endAt: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("ปฏิเสธเมื่อ endAt ไม่มากกว่า startAt", () => {
    const result = rescheduleAppointmentItemSchema.safeParse({
      staffId: "staff_1",
      roomId: "room_1",
      startAt: "2026-09-01T10:00:00.000Z",
      endAt: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("ปฏิเสธเมื่อไม่ส่ง staffId/roomId มา", () => {
    const result = rescheduleAppointmentItemSchema.safeParse({
      startAt: "2026-09-01T09:00:00.000Z",
      endAt: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("createWalkInAppointmentSchema", () => {
  it("ยอมรับแค่ serviceVariantId อย่างเดียว (ลูกค้า walk-in ไม่มี memberId ก็ได้)", () => {
    const result = createWalkInAppointmentSchema.safeParse({ serviceVariantId: "variant_1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memberId).toBeUndefined();
  });

  it("ยอมรับ memberId ที่ระบุมาด้วย", () => {
    const result = createWalkInAppointmentSchema.safeParse({
      serviceVariantId: "variant_1",
      memberId: "member_1",
    });
    expect(result.success).toBe(true);
  });

  it("ปฏิเสธเมื่อไม่ส่ง serviceVariantId มา", () => {
    const result = createWalkInAppointmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createAdvanceAppointmentSchema", () => {
  function isoInDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  it("ยอมรับเวลานัดที่อยู่ในอนาคตและไม่เกิน 7 วัน", () => {
    const result = createAdvanceAppointmentSchema.safeParse({
      serviceVariantId: "variant_1",
      staffId: "staff_1",
      roomId: "room_1",
      startAt: isoInDays(2),
    });
    expect(result.success).toBe(true);
  });

  it("ปฏิเสธเวลาที่เป็นอดีต", () => {
    const result = createAdvanceAppointmentSchema.safeParse({
      serviceVariantId: "variant_1",
      staffId: "staff_1",
      roomId: "room_1",
      startAt: isoInDays(-1),
    });
    expect(result.success).toBe(false);
  });

  it(`ปฏิเสธเวลาที่เกิน ${ADVANCE_BOOKING_MAX_DAYS} วันข้างหน้า`, () => {
    const result = createAdvanceAppointmentSchema.safeParse({
      serviceVariantId: "variant_1",
      staffId: "staff_1",
      roomId: "room_1",
      startAt: isoInDays(ADVANCE_BOOKING_MAX_DAYS + 1),
    });
    expect(result.success).toBe(false);
  });

  it("ปฏิเสธเมื่อไม่ส่ง staffId/roomId มา", () => {
    const result = createAdvanceAppointmentSchema.safeParse({
      serviceVariantId: "variant_1",
      startAt: isoInDays(2),
    });
    expect(result.success).toBe(false);
  });
});

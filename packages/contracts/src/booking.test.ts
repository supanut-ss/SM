import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUSES,
  canTransitionAppointmentStatus,
  nextAppointmentStatuses,
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
});

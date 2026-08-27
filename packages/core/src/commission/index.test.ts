import { describe, expect, it } from "vitest";
import { calculateStaffCommission, type ServiceJobForCommission } from "./index.js";

const PERIOD_START = new Date("2026-08-01T00:00:00Z");
const PERIOD_END = new Date("2026-08-16T00:00:00Z");

function job(overrides: Partial<ServiceJobForCommission> & { jobId: string }): ServiceJobForCommission {
  return {
    staffId: "staff-1",
    commissionSatang: 15000,
    completedAt: new Date("2026-08-05T10:00:00Z"),
    voidedAt: null,
    ...overrides,
  };
}

describe("calculateStaffCommission", () => {
  it("คืนอาร์เรย์ว่างถ้าไม่มีใบงานเลย", () => {
    expect(calculateStaffCommission({ jobs: [], periodStart: PERIOD_START, periodEnd: PERIOD_END })).toEqual([]);
  });

  it("นับใบงานเดียวของพนักงานคนเดียว", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1" })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toEqual([
      { staffId: "staff-1", totalCommissionSatang: 15000, jobCount: 1, jobs: [{ jobId: "j1", commissionSatang: 15000 }] },
    ]);
  });

  it("รวมยอดหลายใบงานของพนักงานคนเดียวกันถูกต้อง", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", commissionSatang: 10000 }), job({ jobId: "j2", commissionSatang: 12000 })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.totalCommissionSatang).toBe(22000);
    expect(result[0]!.jobCount).toBe(2);
  });

  it("แยกยอดของพนักงานหลายคนออกจากกัน", () => {
    const result = calculateStaffCommission({
      jobs: [
        job({ jobId: "j1", staffId: "staff-1", commissionSatang: 10000 }),
        job({ jobId: "j2", staffId: "staff-2", commissionSatang: 20000 }),
      ],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toHaveLength(2);
    const staff1 = result.find((r) => r.staffId === "staff-1")!;
    const staff2 = result.find((r) => r.staffId === "staff-2")!;
    expect(staff1.totalCommissionSatang).toBe(10000);
    expect(staff2.totalCommissionSatang).toBe(20000);
  });

  it("ไม่นับใบงานที่ voidedAt ไม่ null (บิลถูกยกเลิก)", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", voidedAt: new Date("2026-08-06T00:00:00Z") })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toEqual([]);
  });

  it("ไม่นับใบงานที่ยังไม่จบ (completedAt เป็น null)", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", completedAt: null })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toEqual([]);
  });

  it("ใบงานที่ completedAt ตรงกับ periodStart เป๊ะ ต้องถูกนับ (inclusive)", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", completedAt: PERIOD_START })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toHaveLength(1);
  });

  it("ใบงานที่ completedAt ตรงกับ periodEnd เป๊ะ ต้องไม่ถูกนับ (exclusive)", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", completedAt: PERIOD_END })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toEqual([]);
  });

  it("ใบงานก่อนหน้า periodStart ต้องไม่ถูกนับ", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", completedAt: new Date("2026-07-31T23:59:59Z") })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toEqual([]);
  });

  it("ใบงานหลัง periodEnd ต้องไม่ถูกนับ", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", completedAt: new Date("2026-08-16T00:00:01Z") })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toEqual([]);
  });

  it("jobCount นับเฉพาะใบงานที่นับได้จริง ไม่รวมที่ถูกกรองออก", () => {
    const result = calculateStaffCommission({
      jobs: [
        job({ jobId: "j1" }),
        job({ jobId: "j2", voidedAt: new Date() }),
        job({ jobId: "j3", completedAt: null }),
      ],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.jobCount).toBe(1);
  });

  it("jobs breakdown มี jobId และ commissionSatang ครบทุกใบที่นับได้", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", commissionSatang: 10000 }), job({ jobId: "j2", commissionSatang: 12000 })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result[0]!.jobs).toEqual([
      { jobId: "j1", commissionSatang: 10000 },
      { jobId: "j2", commissionSatang: 12000 },
    ]);
  });

  it("commissionSatang เท่ากับ 0 ยังถูกนับ (ไม่ถูกกรองออกเหมือนค่า falsy)", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", commissionSatang: 0 })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result[0]!.totalCommissionSatang).toBe(0);
    expect(result[0]!.jobCount).toBe(1);
  });

  it("พนักงานที่ทุกใบงานถูกกรองออกหมด ต้องไม่ปรากฏในผลลัพธ์เลย", () => {
    const result = calculateStaffCommission({
      jobs: [
        job({ jobId: "j1", staffId: "staff-1", voidedAt: new Date() }),
        job({ jobId: "j2", staffId: "staff-2" }),
      ],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result.map((r) => r.staffId)).toEqual(["staff-2"]);
  });

  it("ลำดับ input ไม่เรียงตามพนักงาน ยังรวมยอดถูกต้อง", () => {
    const result = calculateStaffCommission({
      jobs: [
        job({ jobId: "j1", staffId: "staff-1", commissionSatang: 5000 }),
        job({ jobId: "j2", staffId: "staff-2", commissionSatang: 7000 }),
        job({ jobId: "j3", staffId: "staff-1", commissionSatang: 5000 }),
      ],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    const staff1 = result.find((r) => r.staffId === "staff-1")!;
    const staff2 = result.find((r) => r.staffId === "staff-2")!;
    expect(staff1.totalCommissionSatang).toBe(10000);
    expect(staff2.totalCommissionSatang).toBe(7000);
  });

  it("ใบงานจากคนละ branch ปนกันมา ฟังก์ชันไม่กรอง branch เอง (เป็นหน้าที่ผู้เรียก) จึงยังรวมทั้งหมด", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "j1", commissionSatang: 1000 }), job({ jobId: "j2", commissionSatang: 2000 })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result[0]!.totalCommissionSatang).toBe(3000);
  });

  it("periodEnd เท่ากับ periodStart ต้อง throw", () => {
    expect(() =>
      calculateStaffCommission({ jobs: [], periodStart: PERIOD_START, periodEnd: PERIOD_START }),
    ).toThrow("periodEnd ต้องมากกว่า periodStart");
  });

  it("periodEnd น้อยกว่า periodStart ต้อง throw", () => {
    expect(() =>
      calculateStaffCommission({ jobs: [], periodStart: PERIOD_END, periodEnd: PERIOD_START }),
    ).toThrow("periodEnd ต้องมากกว่า periodStart");
  });

  it("จำนวนใบงานมาก (สมูกเทสต์ประสิทธิภาพ) ยังรวมยอดถูกต้อง", () => {
    const jobs = Array.from({ length: 500 }, (_, i) =>
      job({ jobId: `j${i}`, staffId: i % 5 === 0 ? "staff-1" : "staff-2", commissionSatang: 1000 }),
    );
    const result = calculateStaffCommission({ jobs, periodStart: PERIOD_START, periodEnd: PERIOD_END });
    const staff1 = result.find((r) => r.staffId === "staff-1")!;
    const staff2 = result.find((r) => r.staffId === "staff-2")!;
    expect(staff1.jobCount).toBe(100);
    expect(staff2.jobCount).toBe(400);
    expect(staff1.totalCommissionSatang).toBe(100000);
    expect(staff2.totalCommissionSatang).toBe(400000);
  });

  it("jobId ซ้ำกัน (ไม่ควรเกิดขึ้นจริง) ยังถูกนับแยกทุกแถวตามที่ส่งเข้ามา", () => {
    const result = calculateStaffCommission({
      jobs: [job({ jobId: "dup", commissionSatang: 1000 }), job({ jobId: "dup", commissionSatang: 1000 })],
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result[0]!.jobCount).toBe(2);
    expect(result[0]!.totalCommissionSatang).toBe(2000);
  });

  it("periodStart/periodEnd แคบมาก (เสี้ยววินาที) ยังกรองถูกต้อง", () => {
    const start = new Date("2026-08-05T10:00:00.000Z");
    const end = new Date("2026-08-05T10:00:00.001Z");
    const result = calculateStaffCommission({
      jobs: [
        job({ jobId: "in", completedAt: new Date("2026-08-05T10:00:00.000Z") }),
        job({ jobId: "out", completedAt: new Date("2026-08-05T10:00:00.001Z") }),
      ],
      periodStart: start,
      periodEnd: end,
    });
    expect(result[0]!.jobs.map((j) => j.jobId)).toEqual(["in"]);
  });
});

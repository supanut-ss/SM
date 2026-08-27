import { describe, expect, it } from "vitest";
import { composePayrollSummary } from "./index.js";

describe("composePayrollSummary", () => {
  it("รวมยอดปกติ: ค่ามือ + ทิป - หัก", () => {
    const result = composePayrollSummary([
      { staffId: "a", jobCount: 10, commissionSatang: 100000, tipSatang: 5000, deductionSatang: 2000 },
    ]);
    expect(result).toEqual([
      { staffId: "a", jobCount: 10, commissionSatang: 100000, tipSatang: 5000, deductionSatang: 2000, totalSatang: 103000 },
    ]);
  });

  it("ไม่มีหัก (0) totalSatang = commission + tip", () => {
    const result = composePayrollSummary([
      { staffId: "a", jobCount: 5, commissionSatang: 50000, tipSatang: 3000, deductionSatang: 0 },
    ]);
    expect(result[0]!.totalSatang).toBe(53000);
  });

  it("อาร์เรย์ว่างคืนอาร์เรย์ว่าง", () => {
    expect(composePayrollSummary([])).toEqual([]);
  });

  it("หลายคน คำนวณแยกกันถูกต้อง", () => {
    const result = composePayrollSummary([
      { staffId: "a", jobCount: 1, commissionSatang: 10000, tipSatang: 1000, deductionSatang: 0 },
      { staffId: "b", jobCount: 2, commissionSatang: 20000, tipSatang: 2000, deductionSatang: 500 },
    ]);
    expect(result.map((r) => r.totalSatang)).toEqual([11000, 21500]);
  });

  it("หัก > (ค่ามือ+ทิป) ยอมให้ผลลัพธ์ติดลบได้ (ไม่ clamp ที่ 0 — ผู้เรียกตัดสินใจว่าจะจัดการอย่างไร)", () => {
    const result = composePayrollSummary([
      { staffId: "a", jobCount: 0, commissionSatang: 0, tipSatang: 0, deductionSatang: 500 },
    ]);
    expect(result[0]!.totalSatang).toBe(-500);
  });

  it("jobCount ไม่ถูกใช้ในการคำนวณ แต่ต้องถูกส่งผ่านกลับมาเหมือนเดิม", () => {
    const result = composePayrollSummary([
      { staffId: "a", jobCount: 42, commissionSatang: 0, tipSatang: 0, deductionSatang: 0 },
    ]);
    expect(result[0]!.jobCount).toBe(42);
  });
});

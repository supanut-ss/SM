import { describe, expect, it } from "vitest";
import { splitTipsEqually } from "./index.js";

describe("splitTipsEqually", () => {
  it("หารลงตัวพอดี ทุกคนได้เท่ากัน", () => {
    const result = splitTipsEqually({ totalTipSatang: 9000, staffIds: ["a", "b", "c"] });
    expect(result).toEqual([
      { staffId: "a", tipSatang: 3000 },
      { staffId: "b", tipSatang: 3000 },
      { staffId: "c", tipSatang: 3000 },
    ]);
  });

  it("หารไม่ลงตัว เศษแจกให้คนแรก ๆ ตามลำดับ staffIds คนละ 1 สตางค์", () => {
    const result = splitTipsEqually({ totalTipSatang: 100, staffIds: ["a", "b", "c"] });
    expect(result).toEqual([
      { staffId: "a", tipSatang: 34 },
      { staffId: "b", tipSatang: 33 },
      { staffId: "c", tipSatang: 33 },
    ]);
  });

  it("ผลรวมของทุกคนต้องเท่ากับยอดทิปทั้งหมดเป๊ะเสมอ แม้หารไม่ลงตัว", () => {
    const result = splitTipsEqually({ totalTipSatang: 10007, staffIds: ["a", "b", "c", "d", "e"] });
    const sum = result.reduce((acc, r) => acc + r.tipSatang, 0);
    expect(sum).toBe(10007);
  });

  it("พนักงานคนเดียวได้ทั้งหมด", () => {
    const result = splitTipsEqually({ totalTipSatang: 5000, staffIds: ["a"] });
    expect(result).toEqual([{ staffId: "a", tipSatang: 5000 }]);
  });

  it("ยอดทิปเป็น 0 ทุกคนได้ 0", () => {
    const result = splitTipsEqually({ totalTipSatang: 0, staffIds: ["a", "b"] });
    expect(result).toEqual([
      { staffId: "a", tipSatang: 0 },
      { staffId: "b", tipSatang: 0 },
    ]);
  });

  it("staffIds ว่าง -> throw", () => {
    expect(() => splitTipsEqually({ totalTipSatang: 1000, staffIds: [] })).toThrow("ไม่มีพนักงานให้แบ่งทิป");
  });

  it("ยอดทิปติดลบ -> throw", () => {
    expect(() => splitTipsEqually({ totalTipSatang: -1, staffIds: ["a"] })).toThrow("ยอดทิปต้องไม่ติดลบ");
  });

  it("เศษ 1 สตางค์กับพนักงานหลายคน แจกให้แค่คนแรกคนเดียว", () => {
    const result = splitTipsEqually({ totalTipSatang: 301, staffIds: ["a", "b", "c"] });
    expect(result).toEqual([
      { staffId: "a", tipSatang: 101 },
      { staffId: "b", tipSatang: 100 },
      { staffId: "c", tipSatang: 100 },
    ]);
  });

  it("ยอดทิปน้อยกว่าจำนวนพนักงาน — บางคนได้ 0 บางคนได้ 1 สตางค์", () => {
    const result = splitTipsEqually({ totalTipSatang: 2, staffIds: ["a", "b", "c", "d"] });
    expect(result).toEqual([
      { staffId: "a", tipSatang: 1 },
      { staffId: "b", tipSatang: 1 },
      { staffId: "c", tipSatang: 0 },
      { staffId: "d", tipSatang: 0 },
    ]);
  });

  it("ลำดับผลลัพธ์ตรงกับลำดับ staffIds ที่ส่งเข้ามาเสมอ", () => {
    const result = splitTipsEqually({ totalTipSatang: 300, staffIds: ["z", "y", "x"] });
    expect(result.map((r) => r.staffId)).toEqual(["z", "y", "x"]);
  });
});

// แบ่งทิปกองกลาง — pure function เท่านั้น (T6.3, ดู docs/PLAN.md §5) ทิปทั้งหมดเข้ากองกลางพนักงานทุกคน
// เสมอ (docs/DOMAIN.md ข้อ 12) — เกณฑ์ว่า "ทุกคน" หมายถึงใครบ้าง เป็นหน้าที่ของผู้เรียก (apps/api) ที่ต้อง
// ส่ง staffIds ที่ถูกต้องเข้ามา (ค่าเริ่มต้นชั่วคราวตอนนี้: ทุกคนที่มี TimeClockEntry คลุมวันเดียวกับบิล
// ดู docs/decisions.md ADR-032 — ยังไม่ใช่เกณฑ์สุดท้าย รอผู้ใช้ยืนยัน) ฟังก์ชันนี้ตัดสินใจแค่ "หารเงินเป็น
// จำนวนเต็มสตางค์อย่างเป็นธรรมและ deterministic ได้อย่างไร"

export interface SplitTipsEquallyInput {
  totalTipSatang: number;
  /** ต้องไม่ว่าง — ลำดับในอาร์เรย์นี้เป็นตัวกำหนดว่าใครได้เศษสตางค์ที่หารไม่ลงตัว (ดูด้านล่าง) */
  staffIds: string[];
}

export interface TipAllocation {
  staffId: string;
  tipSatang: number;
}

/**
 * หารทิปเท่า ๆ กันเป็นจำนวนเต็มสตางค์ — เศษที่หารไม่ลงตัวแจกให้พนักงาน N คนแรกตามลำดับที่ส่งเข้ามา
 * คนละ 1 สตางค์ (ผู้เรียกต้องส่ง staffIds มาเรียงลำดับที่คงที่ เช่น เรียงตาม staffId เอง เพื่อให้ผล
 * การหารซ้ำแล้วซ้ำอีกออกมาเหมือนเดิมเสมอ — deterministic)
 */
export function splitTipsEqually(input: SplitTipsEquallyInput): TipAllocation[] {
  const { totalTipSatang, staffIds } = input;
  if (staffIds.length === 0) {
    throw new Error("ไม่มีพนักงานให้แบ่งทิป");
  }
  if (totalTipSatang < 0) {
    throw new Error("ยอดทิปต้องไม่ติดลบ");
  }

  const base = Math.floor(totalTipSatang / staffIds.length);
  const remainder = totalTipSatang - base * staffIds.length;

  return staffIds.map((staffId, index) => ({
    staffId,
    tipSatang: base + (index < remainder ? 1 : 0),
  }));
}

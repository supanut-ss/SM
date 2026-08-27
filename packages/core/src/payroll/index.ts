// สรุปยอดจ่ายต่องวด — pure function เท่านั้น (T6.4, ดู docs/PLAN.md §5) รวมค่ามือ (packages/core/commission)
// + ทิป (packages/core/tips) + หัก เป็นยอดสุทธิต่อพนักงาน ไม่มี "หัก" จริงในรอบนี้ (ยังไม่มี requirement
// ในแผน) แต่เผื่อ field ไว้เป็น 0 เพื่อให้ต่อยอดได้ทีหลังโดยไม่ต้องแก้ shape

export interface StaffPayrollLineInput {
  staffId: string;
  jobCount: number;
  commissionSatang: number;
  tipSatang: number;
  deductionSatang: number;
}

export interface StaffPayrollLine extends StaffPayrollLineInput {
  totalSatang: number;
}

/** totalSatang = commissionSatang + tipSatang - deductionSatang เสมอ — คำนวณรวมไว้ที่เดียวกันทุกที่ */
export function composePayrollSummary(lines: StaffPayrollLineInput[]): StaffPayrollLine[] {
  return lines.map((line) => ({
    ...line,
    totalSatang: line.commissionSatang + line.tipSatang - line.deductionSatang,
  }));
}

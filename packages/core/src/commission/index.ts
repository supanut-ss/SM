// ค่ามือ — pure function เท่านั้น (T6.2, ดู docs/PLAN.md §5)
//
// อัตราค่ามือจริง (บาทคงที่ต่อครั้งต่อ ServiceVariant × ระดับพนักงาน) ถูกเลือกและ snapshot ลง
// ServiceJob.commissionSatang ไปแล้วตอนเริ่มงาน (T5.5, ดู docs/decisions.md ADR-029 — คัดเรตตาม
// staffLevelAtJob ตรง ๆ ที่ apps/api/src/modules/booking/appointment-item.controller.ts) ตามที่
// docs/DOMAIN.md ข้อ 9-11 ระบุไว้: เรตเดียวกันทั้งคิวหมุน/ลูกค้าขอ, ตัดคอร์สใช้เรตเดียวกับตั้งไว้
// (ไม่ผูกมูลค่าหน้าบัตร), ไม่มีคอมมิชชั่นขายคอร์ส — จึงไม่มีอะไรให้ "เลือกเรต" อีกที่นี่
//
// สิ่งที่ยังไม่มีที่ไหนทำ (และเป็นหน้าที่ของโมดูลนี้): รวมยอดค่ามือของแต่ละพนักงานสำหรับงวดจ่ายหนึ่งงวด
// (T6.4) จากรายการ ServiceJob ที่ผ่านมา โดยต้องกรอง "ใบงานที่นับได้จริง" ให้ถูกต้องเสมอ (ยังไม่จบงาน
// หรือถูกยกเลิกบิลไปแล้วต้องไม่นับ — ดู docs/decisions.md ADR-029)
//
// ⚠️ ยังไม่มีตารางค่ามือจริงจากเจ้าของร้าน — ค่าที่ seed ไว้ตอนนี้เป็นตัวอย่างเท่านั้น
// (ดู docs/decisions.md ADR-032) ตัวคำนวณรวมยอดนี้ไม่ขึ้นกับตัวเลขจริง ใช้ได้ทันทีที่มีตัวเลขจริงมาแทน

export interface ServiceJobForCommission {
  jobId: string;
  staffId: string;
  /** snapshot มาจาก ServiceJob.commissionSatang — ห้ามคำนวณใหม่จากอัตราปัจจุบันของ ServiceVariant */
  commissionSatang: number;
  /** null = ใบงานยังไม่จบ ไม่นับเข้ารอบจ่าย */
  completedAt: Date | null;
  /** ไม่ null = บิลที่ผูกอยู่ถูกยกเลิกไปแล้ว ใบงานนี้เป็นโมฆะ (ADR-029) ต้องไม่นับ */
  voidedAt: Date | null;
}

export interface CalculateStaffCommissionInput {
  jobs: ServiceJobForCommission[];
  /** ช่วงงวดจ่าย — inclusive */
  periodStart: Date;
  /** ช่วงงวดจ่าย — exclusive */
  periodEnd: Date;
}

export interface StaffCommissionBreakdown {
  staffId: string;
  totalCommissionSatang: number;
  jobCount: number;
  jobs: { jobId: string; commissionSatang: number }[];
}

/**
 * รวมค่ามือของแต่ละพนักงานสำหรับงวดจ่ายหนึ่งงวด — นับเฉพาะใบงานที่จบแล้ว (completedAt ไม่ null),
 * ยังไม่ถูกยกเลิก (voidedAt เป็น null), และ completedAt อยู่ใน [periodStart, periodEnd)
 * คืนเฉพาะพนักงานที่มีอย่างน้อย 1 ใบงานที่นับได้ — ไม่รวมพนักงานที่ไม่มีใบงานเข้าเงื่อนไขเลย
 */
export function calculateStaffCommission(
  input: CalculateStaffCommissionInput,
): StaffCommissionBreakdown[] {
  const { jobs, periodStart, periodEnd } = input;
  if (periodEnd <= periodStart) {
    throw new Error("periodEnd ต้องมากกว่า periodStart");
  }

  const byStaff = new Map<string, StaffCommissionBreakdown>();
  for (const job of jobs) {
    if (job.voidedAt !== null) continue;
    if (job.completedAt === null) continue;
    if (job.completedAt < periodStart || job.completedAt >= periodEnd) continue;

    const existing = byStaff.get(job.staffId) ?? {
      staffId: job.staffId,
      totalCommissionSatang: 0,
      jobCount: 0,
      jobs: [],
    };
    existing.totalCommissionSatang += job.commissionSatang;
    existing.jobCount += 1;
    existing.jobs.push({ jobId: job.jobId, commissionSatang: job.commissionSatang });
    byStaff.set(job.staffId, existing);
  }

  return [...byStaff.values()];
}

import type { AppointmentStatus } from "@lotus-desk/contracts";

/** สีสถานะบน Lane Board ตรงกับ docs/DESIGN.md §3.3 ทุกประการ — ห้ามคิดสีใหม่เอง ต้องใช้ token ที่นี่ */
export interface StatusStyle {
  /** พื้น + ตัวอักษรของบล็อกทั้งก้อน */
  block: string;
  /** สีของ spine (แถบซ้าย 3px) */
  spine: string;
  /** true = spine ทึบ, false = แค่เส้นขอบประรอบบล็อก (BOOKED เท่านั้น) */
  spineSolid: boolean;
  /** กำลังบริการ — มีชีพจรจางที่ spine */
  pulse: boolean;
}

export const STATUS_STYLE: Record<AppointmentStatus, StatusStyle> = {
  BOOKED: {
    block: "border border-dashed border-indigo bg-indigo-tint text-indigo",
    spine: "border-indigo",
    spineSolid: false,
    pulse: false,
  },
  CONFIRMED: {
    block: "bg-indigo-tint text-indigo",
    spine: "bg-indigo",
    spineSolid: true,
    pulse: false,
  },
  CHECKED_IN: {
    block: "bg-brass-tint text-brass",
    spine: "bg-brass",
    spineSolid: true,
    pulse: false,
  },
  IN_SERVICE: {
    block: "bg-celadon-solid text-white",
    spine: "bg-celadon-solid",
    spineSolid: true,
    pulse: true,
  },
  COMPLETED: {
    block: "bg-surface-sunk text-ink-faint",
    spine: "bg-ink-faint",
    spineSolid: true,
    pulse: false,
  },
  NO_SHOW: {
    block: "bg-rose-tint text-rose line-through decoration-rose/50",
    spine: "bg-rose",
    spineSolid: true,
    pulse: false,
  },
  // ไม่แสดงบนกระดานจริง (ดู docs/PLAN.md §3.3 "ไม่แสดงบนกระดาน — ดูได้ในประวัติ") — เก็บไว้ให้ type
  // ครบเท่านั้น อย่าเรียกใช้ style นี้จริง
  CANCELLED: {
    block: "bg-surface-sunk text-ink-faint opacity-40",
    spine: "bg-ink-faint",
    spineSolid: true,
    pulse: false,
  },
};

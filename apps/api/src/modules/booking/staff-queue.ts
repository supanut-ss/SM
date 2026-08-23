import type { AssignType } from "@lotus-desk/contracts";

/**
 * ตรรกะคิวหมุน (T4.4) — pure function ล้วน ไม่แตะ Prisma/DB โดยตรง (แต่ไม่ได้อยู่ใน packages/core เพราะ
 * เป็นเรื่อง server-only ล้วน ๆ ไม่มีฝั่ง apps/web ต้องใช้ซ้ำ ต่างจาก canTransitionAppointmentStatus ที่
 * อยู่ packages/contracts เพราะ UI ต้องใช้ด้วย) ดู docs/decisions.md ADR-022
 *
 * position ยิ่งน้อยยิ่งอยู่หัวคิว (ตัวถัดไปที่จะได้งานคิวหมุน) renumber ใหม่ทุกครั้งที่คิวเปลี่ยนแทนการ
 * คำนวณเลขเศษส่วน/ช่องว่าง — ร้านมีพนักงานไม่กี่คนต่อวัน renumber ทั้งหมดทุกครั้งไม่ใช่ปัญหาประสิทธิภาพ
 */
export interface QueueEntry {
  staffId: string;
  position: number;
}

function renumber(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort((a, b) => a.position - b.position).map((e, i) => ({ ...e, position: i }));
}

/** เพิ่มพนักงานท้ายคิว — ถ้าอยู่ในคิวอยู่แล้วไม่ทำอะไร (idempotent) ใช้ตอน "เข้าคิว" ตอนเริ่มวัน */
export function joinQueue(queue: QueueEntry[], staffId: string): QueueEntry[] {
  if (queue.some((e) => e.staffId === staffId)) return queue;
  const maxPosition = queue.reduce((max, e) => Math.max(max, e.position), -1);
  return renumber([...queue, { staffId, position: maxPosition + 1 }]);
}

/** ย้ายพนักงานไปท้ายคิว (เอาออกจากตำแหน่งเดิมถ้ามีก่อน) — ใช้ตอนจบงานที่เสียตำแหน่งคิว */
export function moveToBack(queue: QueueEntry[], staffId: string): QueueEntry[] {
  const rest = queue.filter((e) => e.staffId !== staffId);
  const maxPosition = rest.reduce((max, e) => Math.max(max, e.position), -1);
  return renumber([...rest, { staffId, position: maxPosition + 1 }]);
}

/** ย้ายพนักงานไปหัวคิว (เอาออกจากตำแหน่งเดิมถ้ามีก่อน) — ใช้ตอนลูกค้ายกเลิกกะทันหัน/ไม่มา (ไม่ใช่ความผิด
 * พนักงาน ดู docs/DOMAIN.md ข้อ 3) */
export function moveToFront(queue: QueueEntry[], staffId: string): QueueEntry[] {
  const rest = queue.filter((e) => e.staffId !== staffId);
  const minPosition = rest.reduce((min, e) => Math.min(min, e.position), 0);
  return renumber([...rest, { staffId, position: minPosition - 1 }]);
}

/**
 * จุดตัดสินใจหลักตอนจบงาน (status → COMPLETED) — งานคิวหมุนเสียตำแหน่งเสมอ ส่วนงาน "ลูกค้าขอ" เสียตำแหน่ง
 * หรือไม่แล้วแต่ Branch.customRequestKeepsQueuePosition (docs/DOMAIN.md ข้อ 2 ของร้านนี้คือ "เสียตำแหน่ง"
 * แต่ทำเป็นค่าตั้งค่าได้ตามที่ docs/PLAN.md T4.4 ระบุ)
 */
export function reorderAfterJobCompleted(
  queue: QueueEntry[],
  staffId: string,
  assignType: AssignType,
  customRequestKeepsQueuePosition: boolean,
): QueueEntry[] {
  if (assignType === "CUSTOMER_REQUEST" && customRequestKeepsQueuePosition) {
    return queue;
  }
  return moveToBack(queue, staffId);
}

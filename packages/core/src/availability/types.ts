// ชนิดข้อมูลนำเข้า/ผลลัพธ์ของ availability engine (T4.1) — ประกาศเองในนี้ทั้งหมด ไม่ import จาก
// @lotus-desk/contracts หรือที่ไหนอื่น เพราะ packages/core ตั้งใจให้ไม่มี dependency ใด ๆ เลย
// (ดู package.json ที่ไม่มี dependencies เลยแม้แต่ workspace เดียว) เพื่อค้ำประกันด้วยเครื่องมือ
// (ไม่ใช่แค่ธรรมเนียม) ว่าจะไม่มีทางดึง Prisma เข้ามาทางอ้อมผ่าน contracts ได้ — ดู docs/decisions.md ADR-019
// ค่า literal ของ StaffLevel/StaffSkill ตรงกับ @lotus-desk/contracts โดยตั้งใจ (structural typing ทำให้
// ค่าจริงจากฝั่งนั้นใช้ตรงนี้ได้โดยไม่ต้องแปลง) แต่เป็นคนละ type declaration กันโดยเจตนา

export type StaffLevel = "JUNIOR" | "SENIOR" | "MASTER";
export type StaffSkill = "THAI_MASSAGE" | "OIL" | "FACIAL" | "NAIL";

/**
 * กะทำงานจริง 1 ช่วงต่อพนักงาน — ผู้เรียกต้องกรองมาแล้วเฉพาะของ "วันนั้น" และแปลง startMin/endMin
 * (ที่เก็บใน DB) เป็น Date จริงของวันนั้นก่อนส่งเข้ามา ถ้าพนักงานมีกะแบ่งครึ่ง (พักเที่ยง) ให้ส่งมาเป็น
 * StaffShift 2 รายการแยกกัน (คนละช่วง) ไม่ใช่ 1 รายการที่มีช่องว่างตรงกลาง
 */
export interface StaffShift {
  staffId: string;
  start: Date;
  end: Date;
}

/** พนักงานลาวันนั้น — ผู้เรียกกรองมาแล้วเฉพาะวันที่กำลังหาช่องว่างเท่านั้น (ไม่ต้องส่งช่วงวันที่มา) */
export interface StaffLeave {
  staffId: string;
}

/** นัดที่มีอยู่แล้ว (ยังไม่รวม buffer — engine เป็นคนคำนวณ buffer เอง) */
export interface BookedBlock {
  staffId: string;
  roomId: string;
  start: Date;
  end: Date;
}

export interface StaffProfile {
  id: string;
  skills: StaffSkill[];
  level: StaffLevel;
}

export interface Room {
  id: string;
  roomTypeId: string;
  /** จำนวนคนที่ใช้ห้องพร้อมกันได้สูงสุด (เช่น เก้าอี้ทำเล็บ 2 ที่นั่งในห้องเดียว) */
  capacity: number;
}

export interface ServiceVariant {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  requiredSkill: StaffSkill;
  requiredRoomTypeId: string;
}

export interface FindAvailableSlotsInput {
  /** เวลาปัจจุบันจริง — ห้ามเรียก Date.now() ในนี้ ผู้เรียกต้องส่งมาเป็น parameter เสมอ */
  now: Date;
  /** วันที่กำลังหาช่องว่าง (ข้อมูลประกอบ/บริบท — เงื่อนไขจริงทั้งหมดมาจาก start/end ของ shifts/existing) */
  date: Date;
  shifts: StaffShift[];
  leaves: StaffLeave[];
  existing: BookedBlock[];
  staff: StaffProfile[];
  rooms: Room[];
  service: ServiceVariant;
  /** ความละเอียดของช่องเวลาที่จะเสนอ หน่วยนาที (เช่น 15 หรือ 30) */
  granularityMin: number;
  /** ถ้าระบุ จะคืนเฉพาะช่องว่างของพนักงานคนนี้เท่านั้น */
  preferredStaffId?: string;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  staffId: string;
  roomId: string;
}

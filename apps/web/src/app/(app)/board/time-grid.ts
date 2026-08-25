/** พิกัดของ Lane Board (T4.5) — dayStart คือเวลาเริ่มต้นกระดาน (instant จริง) pxPerMin คือ zoom ปัจจุบัน */
export interface TimeGridConfig {
  dayStart: Date;
  pxPerMin: number;
}

/** เวลา → ตำแหน่งพิกเซลแกน X นับจากซ้ายกระดาน */
export function timeToX(time: Date, config: TimeGridConfig): number {
  const minutesFromStart = (time.getTime() - config.dayStart.getTime()) / 60_000;
  return minutesFromStart * config.pxPerMin;
}

/** ตำแหน่งพิกเซล → นาทีนับจากซ้ายกระดาน (ยังไม่ snap เข้ากริด) */
export function xToMinutesFromStart(x: number, config: TimeGridConfig): number {
  return x / config.pxPerMin;
}

/** ปัดนาทีเข้ากริดที่ใกล้ที่สุด (15/30/60) */
export function snapMinutes(minutes: number, granularityMin: number): number {
  return Math.round(minutes / granularityMin) * granularityMin;
}

export function minutesToTime(dayStart: Date, minutes: number): Date {
  return new Date(dayStart.getTime() + minutes * 60_000);
}

export function durationMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

/** ความกว้างเป็นพิกเซลของช่วงเวลาหนึ่ง ๆ บนกระดาน */
export function durationToWidth(start: Date, end: Date, config: TimeGridConfig): number {
  return durationMinutes(start, end) * config.pxPerMin;
}

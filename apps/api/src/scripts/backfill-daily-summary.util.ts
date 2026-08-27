import { toBangkokDateOnly } from "../modules/reports/bangkok-time";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60_000;

function parseDateOnlyArg(flag: "from" | "to", value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error(`--${flag}="${value}" ไม่ใช่วันที่รูปแบบ YYYY-MM-DD`);
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/**
 * แยก --from=YYYY-MM-DD / --to=YYYY-MM-DD จาก argv ของสคริปต์ backfill (T7.1) — ไม่ระบุทั้งคู่ = ย้อนหลัง
 * 365 วันปฏิทินไทยล่าสุด นับถึงเมื่อวาน (เทียบกับ `today` ที่รับมาเป็น parameter เพื่อ unit test ได้โดยไม่
 * ต้องพึ่ง Date.now() — เหตุผลเดียวกับกฎ packages/core แม้ไฟล์นี้จะไม่ได้อยู่ใน packages/core ก็ตาม)
 * คืนทั้ง `from`/`to` เป็นวันที่ (เที่ยงคืน UTC) ตามปฏิทินไทย ช่วง inclusive ทั้งสองปลาย
 */
export function parseDateRangeArgs(argv: string[], today: Date): { from: Date; to: Date } {
  let fromArg: string | undefined;
  let toArg: string | undefined;
  for (const arg of argv) {
    const fromMatch = /^--from=(.+)$/.exec(arg);
    const toMatch = /^--to=(.+)$/.exec(arg);
    if (fromMatch) fromArg = fromMatch[1];
    if (toMatch) toArg = toMatch[1];
  }

  const yesterday = new Date(toBangkokDateOnly(today).getTime() - MS_PER_DAY);
  const to = toArg !== undefined ? parseDateOnlyArg("to", toArg) : yesterday;
  const from = fromArg !== undefined ? parseDateOnlyArg("from", fromArg) : new Date(to.getTime() - 364 * MS_PER_DAY);

  if (from.getTime() > to.getTime()) {
    throw new Error(`--from ต้องไม่มากกว่า --to (ได้ from=${fromArg ?? "?"} to=${toArg ?? "?"})`);
  }

  return { from, to };
}

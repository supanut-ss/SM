import { PrismaService } from "../prisma/prisma.service";
import { DailySummaryService } from "../modules/reports/daily-summary.service";
import { parseDateRangeArgs } from "./backfill-daily-summary.util";

const MS_PER_DAY = 24 * 60 * 60_000;
const PROGRESS_EVERY_DAYS = 30;

/**
 * Backfill สรุปรายวันย้อนหลัง (T7.1) — ประมวลผลทีละวันปฏิทินไทยตามลำดับ (ไม่ทำขนาน เพื่อคุมโหลด DB ให้
 * คาดเดาได้) เรียก DailySummaryService.computeAndUpsertForAllBranches ตัวเดียวกับที่ cron job ใช้ ปลอดภัย
 * ที่จะรันซ้ำ (idempotent, upsert ทุกครั้ง)
 *
 *   pnpm --filter @lotus-desk/api backfill:daily-summary -- --from=2026-01-01 --to=2026-08-27
 *   pnpm --filter @lotus-desk/api backfill:daily-summary          # ค่าเริ่มต้น: ย้อนหลัง 365 วัน ถึงเมื่อวาน
 *
 * ตั้งใจ "ไม่" bootstrap ทั้งแอปผ่าน NestFactory.createApplicationContext(AppModule) แม้ PrismaService/
 * DailySummaryService จะเป็น Nest provider ปกติ — เพราะสคริปต์นี้รันด้วย tsx (esbuild) ซึ่ง**ไม่รองรับ
 * emitDecoratorMetadata เลย** (ข้อจำกัดที่รู้กันของ esbuild เอง ไม่ใช่ตั้งค่าไฟล์ tsconfig ผิด) ทำให้
 * Reflect.getMetadata("design:paramtypes", ...) คืนค่า undefined เสมอเมื่อรันผ่าน tsx — Nest DI แบบ
 * inject อัตโนมัติจาก constructor type จะพังเงียบ ๆ (inject undefined ไม่ throw ให้เห็นชัด) ทั้งสอง
 * provider ที่ต้องใช้ที่นี่บังเอิญไม่มี dependency ที่ซับซ้อน (PrismaService ไม่มี constructor param เลย,
 * DailySummaryService รับแค่ PrismaService ตัวเดียว) จึง `new` ตรง ๆ ได้โดยไม่ต้องพึ่ง Nest DI/reflection
 * เลย — เร็วกว่าด้วย (ไม่ต้อง bootstrap โมดูลอื่นทั้งหมดที่ไม่เกี่ยวข้อง เช่น Auth/RBAC/Audit)
 */
async function main(): Promise<void> {
  const { from, to } = parseDateRangeArgs(process.argv.slice(2), new Date());
  const totalDays = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;

  console.log(
    `backfill-daily-summary: เริ่มประมวลผล ${totalDays} วัน ` +
      `(${from.toISOString().slice(0, 10)} ถึง ${to.toISOString().slice(0, 10)})`,
  );

  const prismaService = new PrismaService();
  const dailySummaryService = new DailySummaryService(prismaService);

  const startedAt = Date.now();
  let processed = 0;
  try {
    for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += MS_PER_DAY) {
      await dailySummaryService.computeAndUpsertForAllBranches(new Date(cursor));
      processed += 1;
      if (processed % PROGRESS_EVERY_DAYS === 0) {
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`backfill-daily-summary: ประมวลผลแล้ว ${processed}/${totalDays} วัน (${elapsedSec}s)`);
      }
    }
  } finally {
    await prismaService.client.$disconnect();
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`backfill-daily-summary: เสร็จสิ้น ${processed} วัน ใช้เวลา ${elapsedSec} วินาที`);
}

main().catch((error: unknown) => {
  console.error("backfill-daily-summary: ล้มเหลว", error);
  process.exitCode = 1;
});

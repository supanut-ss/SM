import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import type { Env } from "../../config/env.schema";
import { toBangkokDateOnly } from "./bangkok-time";
import { DailySummaryService } from "./daily-summary.service";

const QUEUE_NAME = "daily-summary";
/** jobId คงที่ — ทำให้ลงทะเบียน repeatable job ซ้ำได้ทุกครั้งที่แอป boot โดย BullMQ ไม่สร้างซ้ำ (dedupe ให้เอง) */
const REPEATABLE_JOB_ID = "daily-summary-cron";

/**
 * ตั้ง BullMQ cron ตี 2 (Asia/Bangkok) ให้สรุปสถิติของ "เมื่อวาน" ทุกสาขา (T7.1) — ไม่ใช้ @nestjs/bullmq
 * ตามที่ตกลงกันไว้ ต่อ Queue/Worker ของ BullMQ ตรง ๆ เป็น provider ธรรมดา ผูก lifecycle ด้วย
 * OnModuleInit/OnModuleDestroy (เปิด/ปิด Redis connection พร้อมแอป) connection ต้องตั้ง
 * maxRetriesPerRequest: null ตามที่ BullMQ บังคับ
 */
@Injectable()
export class DailySummaryQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailySummaryQueue.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly dailySummaryService: DailySummaryService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.connection = new IORedis(this.config.get("REDIS_URL", { infer: true }), {
      maxRetriesPerRequest: null,
    });
    this.connection.on("error", (error) => {
      this.logger.error("Redis connection error (daily-summary queue)", error instanceof Error ? error.stack : String(error));
    });

    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

    this.worker = new Worker(QUEUE_NAME, () => this.runDailySummary(), { connection: this.connection });
    this.worker.on("failed", (job, error) => {
      this.logger.error(`งาน daily-summary (${job?.id ?? "unknown"}) ล้มเหลว`, error.stack);
    });

    // bullmq 6.x ย้าย repeatable job ออกจาก queue.add({ repeat }) (เอาออกจาก JobsOptions แล้ว) มาเป็น
    // upsertJobScheduler แทน — ความหมายเดียวกับที่ต้องการ (ลงทะเบียนซ้ำได้ทุกครั้งที่แอป boot โดยไม่ซ้ำ
    // เพราะ jobSchedulerId คงที่ ถือเป็น key เดียวกับที่ตั้งใจใช้ jobId เดิม)
    await this.queue.upsertJobScheduler(
      REPEATABLE_JOB_ID,
      { pattern: "0 2 * * *", tz: "Asia/Bangkok" },
      { name: "compute-daily-summary" },
    );
    this.logger.log('ลงทะเบียน repeatable job "daily-summary" — รันทุกวันตี 2 เวลาไทย');
  }

  /** ตี 2 ของวันนี้ สรุป "เมื่อวาน" — วันที่เพิ่งจบไปเต็มวันแล้ว ไม่ใช่วันที่เพิ่งเริ่มมา 2 ชม. */
  private async runDailySummary(): Promise<void> {
    const todayBangkok = toBangkokDateOnly(new Date());
    const yesterday = new Date(todayBangkok.getTime() - 24 * 60 * 60_000);
    const label = yesterday.toISOString().slice(0, 10);

    this.logger.log(`เริ่มสรุปรายวันของ ${label}`);
    try {
      await this.dailySummaryService.computeAndUpsertForAllBranches(yesterday);
      this.logger.log(`สรุปรายวันของ ${label} สำเร็จ`);
    } catch (error) {
      this.logger.error(`สรุปรายวันของ ${label} ล้มเหลว`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }
}

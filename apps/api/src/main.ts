import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { Env } from "./config/env.schema";
import { requestIdMiddleware } from "./common/request-id.middleware";

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);
  app.enableCors({
    origin: config.get("CORS_ORIGIN", { infer: true }).split(","),
    credentials: true,
  });
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get("PORT", { infer: true }));
}

// เรียก bootstrap() เฉพาะตอนรันไฟล์นี้เป็น entry point จริง (node dist/main.js) ไม่ใช่ตอนถูก import —
// e2e spec ทุกไฟล์ import { createApp } จากไฟล์นี้ (ดู *.e2e-spec.ts) ถ้าไม่มี guard นี้ทุกไฟล์ที่ import
// จะสั่ง listen() บน PORT เดียวกันไปด้วยเสมอ พอรันหลาย spec พร้อมกัน (ปกติของ vitest) จะชนพอร์ตกันเอง
// (EADDRINUSE) — apps/api compile เป็น CommonJS (ดู docs/decisions.md ADR-005) จึงใช้ require.main ตรวจได้
if (require.main === module) {
  void bootstrap();
}

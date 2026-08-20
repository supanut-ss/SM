import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

// โหลด .env ที่ root ของ repo เอง ห้ามพึ่งพา @nestjs/config ของ apps/api อย่างเดียว — apps/api import
// @lotus-desk/db ผ่าน static import chain ซึ่ง JS evaluate ก่อน ConfigModule.forRoot() ในไฟล์ที่ import
// มันเสมอ (import ถูก hoist) ถ้าไม่โหลดเองตรงนี้ ตัวแปรอย่าง DATABASE_URL/APP_DATABASE_URL จะยังเป็น
// undefined ตอนสร้าง PrismaClient ด้านล่าง (พิสูจน์แล้วด้วย diagnostic log จริงตอนแก้ T1.5)
// dotenv ไม่ทับค่าที่ process.env มีอยู่แล้ว จึงไม่ชนกับ test ที่ set env เองก่อน import (ดู *.e2e-spec.ts)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../../../.env") });

declare global {
  // pattern มาตรฐานของ Prisma กัน hot-reload เปิด connection ซ้ำตอน dev
  var __prisma: PrismaClient | undefined;
}

// APP_DATABASE_URL = role ที่ถูก REVOKE UPDATE/DELETE บน audit_logs แล้ว (lotus_app — ดู T1.5
// migration 20260820213921_audit_log_protection) ใช้ตอนแอปรันจริง แยกจาก DATABASE_URL ที่
// migrate/seed ใช้ (role เจ้าของตาราง) — ถ้าไม่ได้ตั้ง APP_DATABASE_URL ไว้ (เช่นตอน test) fallback
// กลับไปที่ DATABASE_URL ปกติ
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    datasourceUrl: process.env.APP_DATABASE_URL || process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

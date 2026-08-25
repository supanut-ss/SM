import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "@prisma/client";

// ห้ามใช้ `export * from "@prisma/client"` — พิสูจน์แล้วว่า Node's require(esm) (ที่ apps/api ใช้ตอน
// require("@lotus-desk/db") ข้ามขอบเขต CJS/ESM ตาม ADR-004/ADR-005) มีบั๊ก/ข้อจำกัดจริงที่ทำให้ named
// export ที่ประกาศเองในไฟล์นี้ (prisma ด้านล่าง) หายไปเงียบ ๆ เมื่ออยู่ร่วมกับ `export *` ของ CJS module
// ขนาดใหญ่แบบ @prisma/client (ทดสอบแยกแล้วยืนยันด้วย minimal repro — ดู docs/decisions.md ADR-015)
// ผลคือ `this.prisma.client` เป็น undefined ทุก request ตอนรันจริงผ่าน `node dist/main.js`/`nest start`
// (แต่ไม่มีทางเจอผ่าน e2e spec เพราะ e2e ใช้ dynamic `await import()` ซึ่งไม่ผ่านเส้นทาง require(esm) นี้)
// แก้โดย re-export เฉพาะ symbol ที่ apps/api ใช้จริงแบบ explicit แทน — เพิ่มรายการนี้เมื่อมีการใช้ symbol
// ใหม่จาก @prisma/client ผ่าน @lotus-desk/db ในอนาคต
export { PrismaClient, Prisma, AuditAction } from "@prisma/client";
// type-only — ไม่มี JS ถูก emit เลย (ดู dist/index.js) จึงไม่มีทางไปโดนบั๊ก require(esm) ข้างบนได้เลย
// ใช้ครอบคลุมกว้างแทนไล่ export ชื่อโมเดลทีละตัว เพราะ TS ต้องการ "ตั้งชื่อ" type ที่ inferred จาก
// Prisma.XxxGetPayload ในทุก controller method ที่คืนค่าตรงจาก Prisma Client (TS2742)
export type * from "@prisma/client";

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

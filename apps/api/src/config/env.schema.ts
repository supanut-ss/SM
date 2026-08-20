import { z } from "zod";

// ตัวแปรที่จำเป็นต่อการ boot — ขาดตัวไหนแอปต้อง fail ทันทีพร้อมบอกชื่อตัวแปร (ดู docs/PLAN.md T0.2)
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL ห้ามว่าง — ดู .env.example"),
  REDIS_URL: z.string().min(1, "REDIS_URL ห้ามว่าง — ดู .env.example"),
  SMTP_HOST: z.string().min(1, "SMTP_HOST ห้ามว่าง — ดู .env.example"),
  SMTP_PORT: z.coerce.number().int().positive(),
  // ล็อกไว้ตาม docs/PLAN.md §1: access 15 นาที / refresh 30 วัน — ห้ามเปลี่ยนค่า default เอง
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร — ดู .env.example"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร — ดู .env.example"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
});

export type Env = z.infer<typeof envSchema>;

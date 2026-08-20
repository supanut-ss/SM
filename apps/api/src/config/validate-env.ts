import { envSchema, type Env } from "./env.schema";

/**
 * ใช้เป็น `validate` ของ @nestjs/config — ถ้าตัวแปรแวดล้อมขาดหรือผิดรูปแบบ
 * โยน error พร้อม "ชื่อตัวแปร + เหตุผล" ทุกตัวที่ผิด แล้วให้ Nest หยุด boot ทันที
 * (ห้าม fallback เงียบ ๆ เพราะ config ผิดตอน production จะทำให้ต่อ DB/Redis ผิดที่โดยไม่รู้ตัว)
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`ตัวแปรแวดล้อมไม่ถูกต้อง ตรวจสอบ .env (ดูตัวอย่างที่ .env.example):\n${issues}`);
  }

  return result.data;
}

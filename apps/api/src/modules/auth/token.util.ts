import { createHash } from "node:crypto";

/**
 * แปลง refresh token ดิบเป็น hash แบบ deterministic เพื่อค้นหาใน DB ได้ตรง ๆ
 * ใช้ SHA-256 ไม่ใช่ argon2 — ตรงนี้ต้องการ exact-match lookup เร็ว ๆ ไม่ใช่การป้องกัน brute-force
 * รหัสผ่าน/PIN ของผู้ใช้ (ที่ต้อง verify แบบช้า+salt) ยังคงใช้ argon2 เหมือนเดิม
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 วัน — ล็อกไว้ตาม docs/PLAN.md §1
export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 นาที

// PIN login เครื่องหน้าร้าน (T1.3) — session สั้นกว่า ไม่มี refresh ในตัว หมดอายุแล้วต้องกด PIN ใหม่
export const PIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 ชั่วโมง
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 นาที

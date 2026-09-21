-- login ด้วยชื่อได้แทนอีเมลได้ด้วย (ดู docs/decisions.md ADR-065) — ชื่อต้องไม่ซ้ำกันถึงจะใช้แยกตัวคนได้
-- บังคับ "ภาษาอังกฤษเท่านั้น" ไว้ที่ createUserSchema/updateUserSchema (application layer) ไม่ใช่ที่ DB
ALTER TABLE "users" ADD CONSTRAINT "users_name_key" UNIQUE ("name");

-- migration นี้เขียน SQL เองล้วน ๆ ไม่ได้มาจาก `prisma migrate diff` เพราะ role/grant
-- ไม่มีทางแทนด้วย Prisma schema DSL ได้เลย (ดู docs/PLAN.md T1.5, CLAUDE.md ข้อ 7)
--
-- เหตุผลที่ต้องสร้าง role ใหม่แยกต่างหาก (lotus_app) แทนที่จะ REVOKE จาก role เดิม (lotus):
-- ใน Postgres เจ้าของตาราง (table owner) ข้ามการตรวจสิทธิ์ทุกกรณีเสมอ ไม่ว่าจะ REVOKE อะไรออกก็ตาม
-- role "lotus" คือคนสร้างตาราง (รัน migration) จึงเป็นเจ้าของ — REVOKE จาก lotus จะไม่มีผลอะไรเลย
-- ต้องให้แอปรันจริงด้วย role อื่นที่ไม่ใช่เจ้าของ REVOKE ถึงจะบังคับใช้ได้จริงที่ระดับ DB
--
-- รหัสผ่านนี้สำหรับ dev เท่านั้น — production ต้องตั้งใหม่ผ่าน secrets manager แยกต่างหาก (ไม่ใช่ migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lotus_app') THEN
    CREATE ROLE lotus_app WITH LOGIN PASSWORD 'lotus_app_dev_only';
  END IF;
END
$$;

-- ใช้ current_database() แบบ dynamic ไม่ hardcode ชื่อ DB ตรง ๆ — migration นี้ต้องรันได้ทั้งใน
-- dev (lotus_desk), CI/Testcontainers (ชื่อ DB สุ่ม/default ต่างกัน), และสภาพแวดล้อมอื่นที่ตั้งชื่อ DB ต่างไป
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO lotus_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO lotus_app;

-- ตารางทั่วไป: แอปอ่าน/เขียน/แก้/ลบได้ตามปกติ (สิทธิ์ธุรกิจจริงเช็คที่ PermissionGuard ไม่ใช่ที่นี่)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lotus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lotus_app;

-- audit_logs: เขียนเพิ่ม (INSERT) และอ่านได้ แต่ "แก้" หรือ "ลบ" ของเดิมไม่ได้เด็ดขาด แม้แต่แอปเอง
-- ป้องกันทั้งบั๊กในโค้ดแอปและคนที่ต่อ DB ตรง ๆ ด้วย credential ของแอป (ดูเกณฑ์ผ่าน T1.5)
REVOKE UPDATE, DELETE ON audit_logs FROM lotus_app;

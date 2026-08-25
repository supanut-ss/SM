-- รันอัตโนมัติครั้งแรกที่ container postgres สร้างขึ้น (docker-entrypoint-initdb.d)
-- ต้องมี btree_gist สำหรับ EXCLUDE USING gist (กันจองซ้อน — ดู docs/PLAN.md §1, T4.2)
-- ยังไม่ประกาศผ่าน Prisma schema DSL เพราะยังไม่มี index ไหนใช้จริง (รอ T4.2) — เมื่อถึงตอนนั้นให้ย้ายไป
-- ประกาศใน schema.prisma แบบเดียวกับ pg_trgm แทน (ดู ADR-017 — ห้ามสร้าง extension ผ่าน init script คู่กับ
-- Prisma migration พร้อมกัน จะทำให้ migrate diff สับสน) ไม่ใช่เพิ่มบรรทัดตรงนี้อีก
--
-- หมายเหตุ: pg_trgm ที่เคยอยู่ที่นี่ย้ายไปประกาศผ่าน Prisma schema DSL แล้ว (T3.1/ADR-017) — สร้างผ่าน
-- migration `20260823110144_member_consents` โดยตรง ไม่ต้องพึ่งไฟล์นี้อีกต่อไป
CREATE EXTENSION IF NOT EXISTS btree_gist;

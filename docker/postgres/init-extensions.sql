-- รันอัตโนมัติครั้งแรกที่ container postgres สร้างขึ้น (docker-entrypoint-initdb.d)
-- ต้องมี btree_gist สำหรับ EXCLUDE USING gist (กันจองซ้อน — ดู docs/PLAN.md §1, T4.2)
-- ต้องมี pg_trgm สำหรับค้นหาสมาชิกแบบพิมพ์ไม่ครบก็เจอ (ดู T3.1)
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

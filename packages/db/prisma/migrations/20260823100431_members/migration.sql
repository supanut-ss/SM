-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_branchId_idx" ON "members"("branchId");

-- CreateIndex
CREATE INDEX "members_branchId_phone_idx" ON "members"("branchId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "members_branchId_code_key" ON "members"("branchId", "code");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ส่วนนี้เขียน SQL เองล้วน ๆ ไม่ได้มาจาก `prisma migrate diff` เพราะ GIN trigram index + operator class
-- (gin_trgm_ops) ไม่มีทางแทนด้วย Prisma schema DSL ได้ตรง ๆ ในเวอร์ชันนี้ (ดู docs/decisions.md ADR-014)
-- ค้นหาสมาชิกแบบพิมพ์ไม่ครบก็เจอ (เกณฑ์ผ่าน T3.1: ค้นหา 10,000 รายการ < 100ms) ใช้ `ILIKE '%...%'`
-- (Prisma "contains" + "insensitive") ซึ่ง trigram GIN index เร่งความเร็วให้ได้โดยเฉพาะ ต่างจาก btree
-- index ปกติที่ช่วยแค่ค้นหาแบบ exact-match/prefix เท่านั้น — extension เปิดไว้แล้วใน docker-compose dev
-- (ดู docker/postgres/init-extensions.sql, T0.2) แต่ยังไม่เคยถูกสร้างผ่าน migration จริงมาก่อน
-- (Testcontainers/production ไม่มี init script นั้น) T3.1 จึงเป็น task แรกที่ต้องสร้างผ่าน migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "members_name_trgm_idx" ON "members" USING gin ("name" gin_trgm_ops);
CREATE INDEX "members_phone_trgm_idx" ON "members" USING gin ("phone" gin_trgm_ops);


-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_items" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "serviceVariantId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "roomCapacityAtBooking" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_branchId_idx" ON "appointments"("branchId");

-- CreateIndex
CREATE INDEX "appointments_memberId_idx" ON "appointments"("memberId");

-- CreateIndex
CREATE INDEX "appointment_items_branchId_idx" ON "appointment_items"("branchId");

-- CreateIndex
CREATE INDEX "appointment_items_staffId_startAt_idx" ON "appointment_items"("staffId", "startAt");

-- CreateIndex
CREATE INDEX "appointment_items_roomId_startAt_idx" ON "appointment_items"("roomId", "startAt");

-- CreateIndex
CREATE INDEX "appointment_items_appointmentId_idx" ON "appointment_items"("appointmentId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma schema DSL has no way to express EXCLUDE constraints — added by hand (ดู docs/decisions.md ADR-020)
-- staffId: กันจองซ้อนเสมอทุกกรณี (พนักงาน 1 คน capacity เป็น 1 เสมอโดยธรรมชาติ)
-- WHERE เฉพาะสถานะที่ยังกันช่องอยู่จริง — นัดที่ยกเลิก/ไม่มาแล้วต้องไม่บล็อกช่องถาวร
ALTER TABLE "appointment_items"
  ADD CONSTRAINT "appointment_items_staff_no_overlap"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tstzrange("startAt", "endAt") WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

-- roomId: กันจองซ้อนเฉพาะห้อง capacity = 1 เท่านั้น (roomCapacityAtBooking คือ snapshot ตอนสร้างแถว)
-- ห้อง capacity > 1 (เช่นห้องทำเล็บ 2 ที่นั่ง) ไม่ผ่าน constraint นี้ ต้องกันด้วย transaction+lock ที่ระดับ
-- service ตอนสร้างนัดจริงแทน เพราะ EXCLUDE constraint นับจำนวนแถวที่ทับกันไม่ได้ ทำได้แค่ "ห้ามทับกันเลย"
ALTER TABLE "appointment_items"
  ADD CONSTRAINT "appointment_items_room_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startAt", "endAt") WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW') AND "roomCapacityAtBooking" = 1);

-- CreateEnum
CREATE TYPE "AssignType" AS ENUM ('ROTATION', 'CUSTOMER_REQUEST');

-- AlterTable
ALTER TABLE "appointment_items" ADD COLUMN     "assignType" "AssignType" NOT NULL DEFAULT 'ROTATION';

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "customRequestKeepsQueuePosition" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "staff_queue_entries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_queue_entries_branchId_date_position_idx" ON "staff_queue_entries"("branchId", "date", "position");

-- CreateIndex
CREATE UNIQUE INDEX "staff_queue_entries_staffId_date_key" ON "staff_queue_entries"("staffId", "date");

-- AddForeignKey
ALTER TABLE "staff_queue_entries" ADD CONSTRAINT "staff_queue_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_queue_entries" ADD CONSTRAINT "staff_queue_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PACKAGE', 'VOUCHER', 'COMPLIMENTARY');

-- CreateTable
CREATE TABLE "service_jobs" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "appointmentItemId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "serviceVariantId" TEXT NOT NULL,
    "assignType" "AssignType" NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "staffLevelAtJob" "StaffLevel" NOT NULL,
    "commissionSatang" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "paymentMethod" "PaymentMethod",
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_jobs_appointmentItemId_key" ON "service_jobs"("appointmentItemId");

-- CreateIndex
CREATE INDEX "service_jobs_branchId_idx" ON "service_jobs"("branchId");

-- CreateIndex
CREATE INDEX "service_jobs_staffId_idx" ON "service_jobs"("staffId");

-- CreateIndex
CREATE INDEX "service_jobs_serviceVariantId_idx" ON "service_jobs"("serviceVariantId");

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_appointmentItemId_fkey" FOREIGN KEY ("appointmentItemId") REFERENCES "appointment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

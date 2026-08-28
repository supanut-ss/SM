-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recognizedRevenueSatang" INTEGER NOT NULL,
    "cashInSatang" INTEGER NOT NULL,
    "cashInPackageSatang" INTEGER NOT NULL,
    "paymentCashSatang" INTEGER NOT NULL,
    "paymentPackageSatang" INTEGER NOT NULL,
    "paymentVoucherSatang" INTEGER NOT NULL,
    "paymentComplimentarySatang" INTEGER NOT NULL,
    "courseSoldCount" INTEGER NOT NULL,
    "courseSoldValueSatang" INTEGER NOT NULL,
    "courseUsedCount" INTEGER NOT NULL,
    "newCustomerCount" INTEGER NOT NULL,
    "returningCustomerCount" INTEGER NOT NULL,
    "noShowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_staff_summaries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "staffId" TEXT NOT NULL,
    "scheduledMinutes" INTEGER NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "jobCount" INTEGER NOT NULL,
    "commissionSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_staff_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_summaries_branchId_date_idx" ON "daily_summaries"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_branchId_date_key" ON "daily_summaries"("branchId", "date");

-- CreateIndex
CREATE INDEX "daily_staff_summaries_branchId_date_idx" ON "daily_staff_summaries"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_staff_summaries_branchId_date_staffId_key" ON "daily_staff_summaries"("branchId", "date", "staffId");

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_staff_summaries" ADD CONSTRAINT "daily_staff_summaries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_staff_summaries" ADD CONSTRAINT "daily_staff_summaries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

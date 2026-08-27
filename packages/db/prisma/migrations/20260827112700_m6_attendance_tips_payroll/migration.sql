-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinLockedUntil" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "time_clock_entries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffShiftId" TEXT,
    "clockInAt" TIMESTAMPTZ NOT NULL,
    "clockOutAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_clock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_tips" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "cashSatang" INTEGER NOT NULL DEFAULT 0,
    "transferSatang" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_allocations" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billTipId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "tipSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tip_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedByUserId" TEXT NOT NULL,
    "periodEnd" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "closedByUserId" TEXT,
    "reopenedAt" TIMESTAMPTZ,
    "reopenedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_period_staff_summaries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "jobCount" INTEGER NOT NULL,
    "commissionSatang" INTEGER NOT NULL,
    "tipSatang" INTEGER NOT NULL,
    "deductionSatang" INTEGER NOT NULL DEFAULT 0,
    "totalSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_period_staff_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_clock_entries_branchId_idx" ON "time_clock_entries"("branchId");

-- CreateIndex
CREATE INDEX "time_clock_entries_staffId_clockInAt_idx" ON "time_clock_entries"("staffId", "clockInAt");

-- CreateIndex
CREATE UNIQUE INDEX "bill_tips_billId_key" ON "bill_tips"("billId");

-- CreateIndex
CREATE INDEX "bill_tips_branchId_idx" ON "bill_tips"("branchId");

-- CreateIndex
CREATE INDEX "tip_allocations_branchId_idx" ON "tip_allocations"("branchId");

-- CreateIndex
CREATE INDEX "tip_allocations_staffId_idx" ON "tip_allocations"("staffId");

-- CreateIndex
CREATE INDEX "payroll_periods_branchId_periodStart_idx" ON "payroll_periods"("branchId", "periodStart");

-- CreateIndex
CREATE INDEX "payroll_period_staff_summaries_branchId_idx" ON "payroll_period_staff_summaries"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_period_staff_summaries_payrollPeriodId_staffId_key" ON "payroll_period_staff_summaries"("payrollPeriodId", "staffId");

-- AddForeignKey
ALTER TABLE "time_clock_entries" ADD CONSTRAINT "time_clock_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_entries" ADD CONSTRAINT "time_clock_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_entries" ADD CONSTRAINT "time_clock_entries_staffShiftId_fkey" FOREIGN KEY ("staffShiftId") REFERENCES "staff_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_tips" ADD CONSTRAINT "bill_tips_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_tips" ADD CONSTRAINT "bill_tips_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_tips" ADD CONSTRAINT "bill_tips_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_allocations" ADD CONSTRAINT "tip_allocations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_allocations" ADD CONSTRAINT "tip_allocations_billTipId_fkey" FOREIGN KEY ("billTipId") REFERENCES "bill_tips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_allocations" ADD CONSTRAINT "tip_allocations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_reopenedByUserId_fkey" FOREIGN KEY ("reopenedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_period_staff_summaries" ADD CONSTRAINT "payroll_period_staff_summaries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_period_staff_summaries" ADD CONSTRAINT "payroll_period_staff_summaries_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_period_staff_summaries" ADD CONSTRAINT "payroll_period_staff_summaries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

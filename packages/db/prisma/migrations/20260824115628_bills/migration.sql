-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillLineKind" AS ENUM ('SERVICE_JOB', 'PRODUCT');

-- AlterTable
ALTER TABLE "service_jobs" ADD COLUMN     "voidedAt" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberId" TEXT,
    "billNumber" TEXT NOT NULL,
    "subtotalSatang" INTEGER NOT NULL,
    "promotionId" TEXT,
    "discountSatang" INTEGER NOT NULL DEFAULT 0,
    "totalSatang" INTEGER NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PAID',
    "cancelledAt" TIMESTAMPTZ,
    "cancelledReason" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_lines" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "kind" "BillLineKind" NOT NULL,
    "serviceJobId" TEXT,
    "description" TEXT NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "memberPackageId" TEXT,
    "memberPackageLedgerEntryId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_payments" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "tenderedSatang" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bills_branchId_idx" ON "bills"("branchId");

-- CreateIndex
CREATE INDEX "bills_memberId_idx" ON "bills"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_branchId_billNumber_key" ON "bills"("branchId", "billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bill_lines_serviceJobId_key" ON "bill_lines"("serviceJobId");

-- CreateIndex
CREATE INDEX "bill_lines_billId_idx" ON "bill_lines"("billId");

-- CreateIndex
CREATE INDEX "bill_lines_branchId_idx" ON "bill_lines"("branchId");

-- CreateIndex
CREATE INDEX "bill_payments_billId_idx" ON "bill_payments"("billId");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_serviceJobId_fkey" FOREIGN KEY ("serviceJobId") REFERENCES "service_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

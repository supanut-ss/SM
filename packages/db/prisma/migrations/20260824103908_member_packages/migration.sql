-- CreateEnum
CREATE TYPE "MemberPackageStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "MemberPackageLedgerKind" AS ENUM ('PURCHASE', 'USE', 'REFUND', 'EXPIRE', 'FREEZE', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateTable
CREATE TABLE "member_packages" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PackageType" NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "sessionCount" INTEGER,
    "valueSatang" INTEGER,
    "serviceVariantId" TEXT,
    "purchasedAt" TIMESTAMPTZ NOT NULL,
    "validDays" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "status" "MemberPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "member_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_package_ledger_entries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberPackageId" TEXT NOT NULL,
    "kind" "MemberPackageLedgerKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "freezeDays" INTEGER,
    "note" TEXT,
    "relatedEntryId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_package_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_packages_branchId_idx" ON "member_packages"("branchId");

-- CreateIndex
CREATE INDEX "member_packages_memberId_idx" ON "member_packages"("memberId");

-- CreateIndex
CREATE INDEX "member_packages_packageId_idx" ON "member_packages"("packageId");

-- CreateIndex
CREATE INDEX "member_package_ledger_entries_memberPackageId_idx" ON "member_package_ledger_entries"("memberPackageId");

-- CreateIndex
CREATE INDEX "member_package_ledger_entries_branchId_idx" ON "member_package_ledger_entries"("branchId");

-- CreateIndex
CREATE INDEX "member_package_ledger_entries_relatedEntryId_idx" ON "member_package_ledger_entries"("relatedEntryId");

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_package_ledger_entries" ADD CONSTRAINT "member_package_ledger_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_package_ledger_entries" ADD CONSTRAINT "member_package_ledger_entries_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_package_ledger_entries" ADD CONSTRAINT "member_package_ledger_entries_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

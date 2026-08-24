-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('SESSION_COUNT', 'VALUE', 'UNLIMITED_DURATION');

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PackageType" NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "sessionCount" INTEGER,
    "valueSatang" INTEGER,
    "serviceVariantId" TEXT,
    "validDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_branchId_idx" ON "packages"("branchId");

-- CreateIndex
CREATE INDEX "packages_serviceVariantId_idx" ON "packages"("serviceVariantId");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "service_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

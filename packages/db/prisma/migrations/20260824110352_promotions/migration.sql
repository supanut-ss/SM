-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF', 'FIXED_PRICE', 'BUY_X_GET_Y', 'BONUS_MINUTES');

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "percentOff" INTEGER,
    "amountOffSatang" INTEGER,
    "fixedPriceSatang" INTEGER,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "bonusMinutes" INTEGER,
    "minSpendSatang" INTEGER,
    "serviceVariantIds" TEXT[],
    "daysOfWeek" INTEGER[],
    "startMinuteOfDay" INTEGER,
    "endMinuteOfDay" INTEGER,
    "firstTimeCustomerOnly" BOOLEAN NOT NULL DEFAULT false,
    "birthdayMonthOnly" BOOLEAN NOT NULL DEFAULT false,
    "memberTiers" TEXT[],
    "quotaTotal" INTEGER,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxRedemptions" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_branchId_idx" ON "promotions"("branchId");

-- CreateIndex
CREATE INDEX "coupons_branchId_idx" ON "coupons"("branchId");

-- CreateIndex
CREATE INDEX "coupons_promotionId_idx" ON "coupons"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_branchId_code_key" ON "coupons"("branchId", "code");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

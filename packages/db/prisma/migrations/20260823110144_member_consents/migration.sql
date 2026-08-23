-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('HEALTH_DATA', 'MARKETING');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "member_consents" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "channel" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_consents_branchId_idx" ON "member_consents"("branchId");

-- CreateIndex
CREATE INDEX "member_consents_memberId_type_createdAt_idx" ON "member_consents"("memberId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "member_consents" ADD CONSTRAINT "member_consents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_consents" ADD CONSTRAINT "member_consents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "members_name_trgm_idx" RENAME TO "members_name_idx";

-- RenameIndex
ALTER INDEX "members_phone_trgm_idx" RENAME TO "members_phone_idx";

-- CreateEnum
CREATE TYPE "StaffLevel" AS ENUM ('JUNIOR', 'SENIOR', 'MASTER');

-- CreateEnum
CREATE TYPE "StaffSkill" AS ENUM ('THAI_MASSAGE', 'OIL', 'FACIAL', 'NAIL');

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "level" "StaffLevel" NOT NULL,
    "skills" "StaffSkill"[],
    "startDate" TIMESTAMPTZ,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_profiles_branchId_idx" ON "staff_profiles"("branchId");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

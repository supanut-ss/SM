/*
  Warnings:

  - You are about to drop the column `userId` on the `staff_profiles` table. All the data in the column will be lost.
  - You are about to drop the `attendance_records` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_branchId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_staffId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_staffShiftId_fkey";

-- DropForeignKey
ALTER TABLE "staff_profiles" DROP CONSTRAINT "staff_profiles_userId_fkey";

-- DropIndex
DROP INDEX "staff_profiles_userId_key";

-- AlterTable
ALTER TABLE "staff_profiles" DROP COLUMN "userId";

-- DropTable
DROP TABLE "attendance_records";

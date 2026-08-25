-- AlterTable
ALTER TABLE "members" ADD COLUMN     "mergedIntoId" TEXT;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "service_jobs" ADD COLUMN     "memberPackageId" TEXT;

-- CreateIndex
CREATE INDEX "service_jobs_memberPackageId_idx" ON "service_jobs"("memberPackageId");

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

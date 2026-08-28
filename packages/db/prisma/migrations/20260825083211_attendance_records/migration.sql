-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "staffShiftId" TEXT,
    "clockInAt" TIMESTAMPTZ NOT NULL,
    "lateMinutes" INTEGER,
    "clockOutAt" TIMESTAMPTZ,
    "otMinutes" INTEGER,
    "earlyLeaveMinutes" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");

-- CreateIndex
CREATE INDEX "attendance_records_branchId_idx" ON "attendance_records"("branchId");

-- CreateIndex
CREATE INDEX "attendance_records_staffId_date_idx" ON "attendance_records"("staffId", "date");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staffShiftId_fkey" FOREIGN KEY ("staffShiftId") REFERENCES "staff_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

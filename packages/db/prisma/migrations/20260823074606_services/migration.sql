-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_variants" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "commissionJuniorSatang" INTEGER NOT NULL,
    "commissionSeniorSatang" INTEGER NOT NULL,
    "commissionMasterSatang" INTEGER NOT NULL,
    "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
    "requiredSkill" "StaffSkill" NOT NULL,
    "requiredRoomTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_categories_branchId_idx" ON "service_categories"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_branchId_name_key" ON "service_categories"("branchId", "name");

-- CreateIndex
CREATE INDEX "services_branchId_idx" ON "services"("branchId");

-- CreateIndex
CREATE INDEX "services_categoryId_idx" ON "services"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "services_branchId_name_key" ON "services"("branchId", "name");

-- CreateIndex
CREATE INDEX "service_variants_serviceId_idx" ON "service_variants"("serviceId");

-- CreateIndex
CREATE INDEX "service_variants_requiredRoomTypeId_idx" ON "service_variants"("requiredRoomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "service_variants_serviceId_durationMin_key" ON "service_variants"("serviceId", "durationMin");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_requiredRoomTypeId_fkey" FOREIGN KEY ("requiredRoomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


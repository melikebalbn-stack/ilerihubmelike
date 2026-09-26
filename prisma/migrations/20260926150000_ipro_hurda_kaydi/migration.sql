-- CreateTable
CREATE TABLE "ipro_hurda_kaydi" (
    "id" TEXT NOT NULL,
    "productionLogId" TEXT NOT NULL,
    "sebepKod" TEXT,
    "sebepAd" TEXT,
    "adet" INTEGER NOT NULL,
    "zaman" TIMESTAMP(3) NOT NULL,
    "kaynak" TEXT NOT NULL,
    "masRejectId" INTEGER,
    "isRework" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipro_hurda_kaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ipro_hurda_kaydi_productionLogId_idx" ON "ipro_hurda_kaydi"("productionLogId");

-- CreateIndex
CREATE INDEX "ipro_hurda_kaydi_zaman_idx" ON "ipro_hurda_kaydi"("zaman");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_hurda_mas_reject_uq" ON "ipro_hurda_kaydi"("masRejectId");

-- AddForeignKey
ALTER TABLE "ipro_hurda_kaydi" ADD CONSTRAINT "ipro_hurda_kaydi_productionLogId_fkey" FOREIGN KEY ("productionLogId") REFERENCES "ipro_production_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "envanter_islem_log" (
    "id" TEXT NOT NULL,
    "aktorId" TEXT,
    "aktorAd" TEXT,
    "islemTipi" TEXT NOT NULL,
    "hedefTip" TEXT NOT NULL,
    "hedefId" TEXT,
    "detay" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envanter_islem_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envanter_islem_log_aktorId_idx" ON "envanter_islem_log"("aktorId");

-- CreateIndex
CREATE INDEX "envanter_islem_log_islemTipi_idx" ON "envanter_islem_log"("islemTipi");

-- CreateIndex
CREATE INDEX "envanter_islem_log_hedefTip_hedefId_idx" ON "envanter_islem_log"("hedefTip", "hedefId");

-- CreateIndex
CREATE INDEX "envanter_islem_log_createdAt_idx" ON "envanter_islem_log"("createdAt");


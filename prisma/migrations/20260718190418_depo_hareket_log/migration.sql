
-- CreateTable
CREATE TABLE "depo_hareket_log" (
    "id" TEXT NOT NULL,
    "olay" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kullaniciAd" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "lotBatchNo" TEXT,
    "miktar" DECIMAL(18,6),
    "kaynakLok" TEXT,
    "hedefLok" TEXT,
    "orderNo" TEXT,
    "releaseNo" TEXT,
    "sequenceNo" TEXT,
    "lineItemNo" INTEGER,
    "sapmaSebep" TEXT,
    "fifoOnerisi" JSONB,
    "etiketIdler" JSONB,
    "detay" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depo_hareket_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "depo_hareket_log_olay_createdAt_idx" ON "depo_hareket_log"("olay", "createdAt");

-- CreateIndex
CREATE INDEX "depo_hareket_log_userId_createdAt_idx" ON "depo_hareket_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "depo_hareket_log_partNo_idx" ON "depo_hareket_log"("partNo");

-- AddForeignKey
ALTER TABLE "depo_hareket_log" ADD CONSTRAINT "depo_hareket_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


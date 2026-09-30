-- Depo hareket logu: geri alma bağlantısı. GERI_AL kaydı geriAlinanId ile orijinal harekete bağlanır;
-- unique → bir işlem yalnız bir kez geri alınır. Additive (nullable kolon + unique index + FK).

-- AlterTable
ALTER TABLE "depo_hareket_log" ADD COLUMN     "geriAlinanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "depo_hareket_log_geriAlinanId_key" ON "depo_hareket_log"("geriAlinanId");

-- AddForeignKey
ALTER TABLE "depo_hareket_log" ADD CONSTRAINT "depo_hareket_log_geriAlinanId_fkey" FOREIGN KEY ("geriAlinanId") REFERENCES "depo_hareket_log"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


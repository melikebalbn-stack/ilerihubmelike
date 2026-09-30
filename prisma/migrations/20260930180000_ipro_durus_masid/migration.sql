-- MAS duruş aynası: IPRO duruşunu MAS ProductionDowntime satırına bağlar (masId).
-- Ayna artık tezgah başına tekilleştirmez; MAS satırı başına bir kayıt, bitiş MAS EndDateTime'dan.
-- Additive (nullable kolon + unique index). Mevcut satırlar geri doldurma scriptiyle bağlanır.

-- AlterTable
ALTER TABLE "ipro_machine_downtime" ADD COLUMN     "masId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ipro_machine_downtime_masId_key" ON "ipro_machine_downtime"("masId");

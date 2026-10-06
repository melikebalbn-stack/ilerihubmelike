/*
  Warnings:

  - A unique constraint covering the columns `[kayitId,tetik,aliciEposta,gonderimGunu,kanal]` on the table `YillikTakvimBildirimLog` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "YillikTakvimBildirimLog_kayitId_tetik_aliciEposta_gonderimG_key";

-- CreateIndex
CREATE UNIQUE INDEX "YillikTakvimBildirimLog_kayitId_tetik_aliciEposta_gonderimG_key" ON "YillikTakvimBildirimLog"("kayitId", "tetik", "aliciEposta", "gonderimGunu", "kanal");

-- ZİYARET RAPORLARI · YÖN + AKSİYON SORUMLU SİCİLİ
--
-- direction: NOT NULL DEFAULT 'OUTGOING' — mevcut 7 kaydın tamamı giden ziyaret
-- (ölçüldü: hiçbirinde "bizi ziyaret / firmamıza geldi" izi yok, location'lar
-- karşı tarafın adresi). Bu yüzden AYRI BACKFILL UPDATE'İ GEREKMEZ; DEFAULT
-- eklenirken PostgreSQL mevcut satırları otomatik doldurur.
--
-- responsibleSicilNo: nullable — serbest metin sorumlular (harici kişi) için
-- boş kalır, mevcut `responsible` metin alanı korunur.

-- CreateEnum
CREATE TYPE "VisitDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- AlterTable
ALTER TABLE "VisitReport" ADD COLUMN     "direction" "VisitDirection" NOT NULL DEFAULT 'OUTGOING';

-- AlterTable
ALTER TABLE "VisitReportAction" ADD COLUMN     "responsibleSicilNo" TEXT;

-- CreateIndex
CREATE INDEX "VisitReport_direction_idx" ON "VisitReport"("direction");


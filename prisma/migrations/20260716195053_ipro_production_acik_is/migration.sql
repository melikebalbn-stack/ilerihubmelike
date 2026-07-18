-- IPRO §7.2 — açık iş (in-progress) durumu: IproProductionLog yaşam döngüsü.
-- ON KOSUL: ipro_production_log BOS (0 satir). Additive-only.
-- durum default KAPALI + tamamlandi default true → eski/mevcut kayıtlar bitmiş sayılır.
-- "başla" endpoint'i ACIK üretir; "bitir"/"durdur" KAPALI'ya çeker.

-- CreateEnum
CREATE TYPE "IproIsDurum" AS ENUM ('ACIK', 'KAPALI');

-- AlterTable
ALTER TABLE "ipro_production_log" ADD COLUMN     "baslatildiAt" TIMESTAMP(3),
ADD COLUMN     "bitirildiAt" TIMESTAMP(3),
ADD COLUMN     "durum" "IproIsDurum" NOT NULL DEFAULT 'KAPALI',
ADD COLUMN     "tamamlandi" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "ipro_production_log_personnelId_ifsOrderNo_ifsOperationNo_idx" ON "ipro_production_log"("personnelId", "ifsOrderNo", "ifsOperationNo");

-- ELLE EKLENEN partial UNIQUE — açık iş tekilliği. Prisma @@unique partial ifade edemez.
-- Bir (operatör, iş emri, operasyon) için aynı anda EN FAZLA bir ACIK satır olabilir.
CREATE UNIQUE INDEX "ipro_production_log_acik_is_uq"
  ON "ipro_production_log" ("personnelId", "ifsOrderNo", "ifsOperationNo")
  WHERE "durum" = 'ACIK';

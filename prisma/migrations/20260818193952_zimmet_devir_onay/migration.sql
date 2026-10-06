-- CreateEnum
CREATE TYPE "ZimmetKaynak" AS ENUM ('MANUEL', 'SYTELINE_DEVIR');

-- AlterTable
ALTER TABLE "ZimmetFormu" ADD COLUMN     "kaynak" "ZimmetKaynak" NOT NULL DEFAULT 'MANUEL',
ADD COLUMN     "redSebebi" TEXT,
ADD COLUMN     "sonBildirimTarihi" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ZimmetFormu_kaynak_durum_idx" ON "ZimmetFormu"("kaynak", "durum");


-- Devir kayıtlarını damgala: 116 Syteline devri kaydını SYTELINE_DEVIR olarak
-- işaretle. '[Syteline devri]' önekine SON kez güveniyoruz (bundan sonra ayrım
-- yapısal `kaynak` alanından gelir). Manuel kayıtlar DEFAULT 'MANUEL' kalır.
UPDATE "ZimmetFormu" SET "kaynak" = 'SYTELINE_DEVIR'
 WHERE "aciklama" LIKE '[Syteline devri]%';

-- AlterTable
ALTER TABLE "KPIDefinition" ADD COLUMN     "oranBirimi" TEXT NOT NULL DEFAULT 'yuzde',
ADD COLUMN     "ortalamaKaynagi" TEXT NOT NULL DEFAULT 'actual',
ADD COLUMN     "yuzdeOlcek" TEXT NOT NULL DEFAULT 'oran';

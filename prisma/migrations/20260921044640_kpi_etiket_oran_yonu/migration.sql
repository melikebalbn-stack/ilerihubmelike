-- AlterTable
ALTER TABLE "KPIDefinition" ADD COLUMN "gerceklesenEtiketi" TEXT NOT NULL DEFAULT 'Gerçekleşen';
ALTER TABLE "KPIDefinition" ADD COLUMN "hedefEtiketi" TEXT NOT NULL DEFAULT 'Hedef';
ALTER TABLE "KPIDefinition" ADD COLUMN "oranYonu" TEXT NOT NULL DEFAULT 'G_H';

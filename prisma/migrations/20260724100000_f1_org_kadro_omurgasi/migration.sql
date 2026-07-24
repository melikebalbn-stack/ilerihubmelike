-- CreateEnum
CREATE TYPE "OrgPositionStatus" AS ENUM ('AKTIF', 'DONDURULDU', 'PLANLANAN');

-- AlterEnum
ALTER TYPE "OrgUnitType" ADD VALUE 'POSITION';

-- AlterTable
ALTER TABLE "OrgEmployee" ADD COLUMN     "personnelId" TEXT;

-- AlterTable
ALTER TABLE "OrgUnit" ADD COLUMN     "gecerlilikBaslangic" DATE,
ADD COLUMN     "gecerlilikBitis" DATE,
ADD COLUMN     "isExternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "positionId" TEXT,
ADD COLUMN     "positionStatus" "OrgPositionStatus" NOT NULL DEFAULT 'AKTIF';

-- CreateTable
CREATE TABLE "OrgBolumMeta" (
    "id" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "dokumanNo" TEXT NOT NULL,
    "ilkYayinTarihi" DATE,
    "revNo" TEXT,
    "sayNo" TEXT,
    "hazirlayan" TEXT,
    "yonetimTemsilcisi" TEXT,
    "gmOnayi" TEXT,
    "gizlilik" TEXT DEFAULT 'HİZMETE ÖZEL',
    "isoMadde" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgBolumMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSorumluluk" (
    "id" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "birinciSorumlu" TEXT NOT NULL,
    "yedekSorumlu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgSorumluluk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgBolumMeta_orgUnitId_key" ON "OrgBolumMeta"("orgUnitId");

-- CreateIndex
CREATE INDEX "OrgSorumluluk_orgUnitId_idx" ON "OrgSorumluluk"("orgUnitId");

-- CreateIndex
CREATE INDEX "OrgEmployee_personnelId_idx" ON "OrgEmployee"("personnelId");

-- CreateIndex
CREATE INDEX "OrgUnit_positionId_idx" ON "OrgUnit"("positionId");

-- AddForeignKey
ALTER TABLE "OrgBolumMeta" ADD CONSTRAINT "OrgBolumMeta_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSorumluluk" ADD CONSTRAINT "OrgSorumluluk_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

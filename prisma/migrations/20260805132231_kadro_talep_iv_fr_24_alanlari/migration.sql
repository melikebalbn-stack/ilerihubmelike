-- CreateEnum
CREATE TYPE "EgitimSeviyesi" AS ENUM ('LISE', 'TEKNIK_LISE', 'ON_LISANS', 'LISANS', 'YUKSEK_LISANS', 'DIGER');

-- CreateEnum
CREATE TYPE "TecrubeDurumu" AS ENUM ('TECRUBELI', 'YENI_MEZUN');

-- CreateEnum
CREATE TYPE "CinsiyetTercihi" AS ENUM ('BAY', 'BAYAN', 'FARKETMEZ');

-- AlterTable
ALTER TABLE "PersonnelRequest" ADD COLUMN     "formHazirlanmaTarihi" TIMESTAMP(3),
ADD COLUMN     "ikTeslimTarihi" TIMESTAMP(3),
ADD COLUMN     "kisilikOzellikleri" TEXT,
ADD COLUMN     "egitimSeviyesi" "EgitimSeviyesi",
ADD COLUMN     "egitimDiger" TEXT,
ADD COLUMN     "tecrubeDurumu" "TecrubeDurumu",
ADD COLUMN     "tecrubeSuresi" TEXT,
ADD COLUMN     "yabanciDilGerekli" BOOLEAN,
ADD COLUMN     "yabanciDiller" JSONB,
ADD COLUMN     "bilgisayarBilgisi" TEXT,
ADD COLUMN     "kaliteSistemBilgisi" TEXT,
ADD COLUMN     "ehliyetGerekli" BOOLEAN,
ADD COLUMN     "ehliyetSinifi" TEXT,
ADD COLUMN     "digerBelgeIhtiyaci" TEXT,
ADD COLUMN     "cinsiyetTercihi" "CinsiyetTercihi",
ADD COLUMN     "yasAraligiMin" INTEGER,
ADD COLUMN     "yasAraligiMax" INTEGER,
ADD COLUMN     "askerlikGerekli" BOOLEAN,
ADD COLUMN     "ayrilanPersonelAdi" TEXT,
ADD COLUMN     "adayKaynaklari" JSONB,
ADD COLUMN     "ilanPortallari" TEXT,
ADD COLUMN     "adayKaynagiDiger" TEXT,
ADD COLUMN     "kadroDoldurulmaTarihi" TIMESTAMP(3),
ADD COLUMN     "iseBaslayanPersonelAdi" TEXT,
ADD COLUMN     "ivOnayId" TEXT,
ADD COLUMN     "ivOnayTarihi" TIMESTAMP(3);

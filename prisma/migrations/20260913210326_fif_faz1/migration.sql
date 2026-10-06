
-- CreateEnum
CREATE TYPE "FifTur" AS ENUM ('DUZELTICI', 'ONLEYICI');

-- CreateEnum
CREATE TYPE "FifDurum" AS ENUM ('TASLAK', 'ONAY_BEKLIYOR', 'FAALIYET', 'KAPATMA_BEKLIYOR', 'ETKINLIK', 'KAPANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "FifSonuc" AS ENUM ('YT', 'ES', 'K');

-- CreateEnum
CREATE TYPE "FifKokNedenKategori" AS ENUM ('INSAN', 'MAKINE', 'MALZEME', 'CEVRE', 'METOD', 'OLCUM', 'YONETIM', 'EMNIYET', 'GUVENLIK');

-- CreateEnum
CREATE TYPE "FifEtkinlikMadde" AS ENUM ('KAPATMA', 'TEKRAR_ETMEME');

-- CreateEnum
CREATE TYPE "FifEkTip" AS ENUM ('ONCE', 'SONRA');

-- CreateTable
CREATE TABLE "Fif" (
    "id" TEXT NOT NULL,
    "kayitNo" TEXT NOT NULL,
    "tur" "FifTur" NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sorumluBolumId" TEXT,
    "yayinlayanBolumId" TEXT,
    "hazirlayanUserId" TEXT,
    "izlemeSorumlusuUserId" TEXT,
    "sorumluOnaylayanUserId" TEXT,
    "yayinlayanOnaylayanUserId" TEXT,
    "uygulamaSorumlusuUserId" TEXT,
    "takipSorumlusuUserId" TEXT,
    "denetlemeAdi" TEXT,
    "uygunsuzlukTanimi" TEXT,
    "standartMadde" TEXT,
    "ekTerminNedeni" TEXT,
    "kokNedenAnalizi" TEXT,
    "kapatmaTarihi" TIMESTAMP(3),
    "kysDegisikligi" BOOLEAN NOT NULL DEFAULT false,
    "riskFirsatGuncelleme" BOOLEAN NOT NULL DEFAULT false,
    "ogrenilenDers" BOOLEAN NOT NULL DEFAULT false,
    "durum" "FifDurum" NOT NULL DEFAULT 'TASLAK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Fif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifFaaliyet" (
    "id" TEXT NOT NULL,
    "fifId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "aciklama" TEXT NOT NULL,
    "hedefTarih" TIMESTAMP(3),
    "gerceklesenTarih" TIMESTAMP(3),
    "sonuc" "FifSonuc",
    "parafUserId" TEXT,
    "parafTarihi" TIMESTAMP(3),

    CONSTRAINT "FifFaaliyet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifEtkinlik" (
    "id" TEXT NOT NULL,
    "fifId" TEXT NOT NULL,
    "madde" "FifEtkinlikMadde" NOT NULL,
    "planlananTarih" TIMESTAMP(3),
    "gerceklesenTarih" TIMESTAMP(3),
    "uygun" BOOLEAN,
    "onayUserId" TEXT,
    "onayTarihi" TIMESTAMP(3),

    CONSTRAINT "FifEtkinlik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifKokNeden" (
    "id" TEXT NOT NULL,
    "fifId" TEXT NOT NULL,
    "kategori" "FifKokNedenKategori" NOT NULL,
    "aciklama" TEXT NOT NULL,

    CONSTRAINT "FifKokNeden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifBesNeden" (
    "id" TEXT NOT NULL,
    "fifId" TEXT NOT NULL,
    "muhtemelSebep" TEXT NOT NULL,
    "neden1" TEXT,
    "neden2" TEXT,
    "neden3" TEXT,
    "neden4" TEXT,
    "neden5" TEXT,

    CONSTRAINT "FifBesNeden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifEk" (
    "id" TEXT NOT NULL,
    "fifId" TEXT NOT NULL,
    "tip" "FifEkTip" NOT NULL,
    "dosyaYolu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FifEk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fif_kayitNo_key" ON "Fif"("kayitNo");

-- CreateIndex
CREATE INDEX "Fif_durum_idx" ON "Fif"("durum");

-- CreateIndex
CREATE INDEX "Fif_sorumluBolumId_idx" ON "Fif"("sorumluBolumId");

-- CreateIndex
CREATE INDEX "Fif_tarih_idx" ON "Fif"("tarih");

-- CreateIndex
CREATE INDEX "FifFaaliyet_fifId_idx" ON "FifFaaliyet"("fifId");

-- CreateIndex
CREATE INDEX "FifEtkinlik_fifId_idx" ON "FifEtkinlik"("fifId");

-- CreateIndex
CREATE INDEX "FifKokNeden_fifId_idx" ON "FifKokNeden"("fifId");

-- CreateIndex
CREATE INDEX "FifBesNeden_fifId_idx" ON "FifBesNeden"("fifId");

-- CreateIndex
CREATE INDEX "FifEk_fifId_idx" ON "FifEk"("fifId");

-- AddForeignKey
ALTER TABLE "Fif" ADD CONSTRAINT "Fif_sorumluBolumId_fkey" FOREIGN KEY ("sorumluBolumId") REFERENCES "DepartmentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fif" ADD CONSTRAINT "Fif_yayinlayanBolumId_fkey" FOREIGN KEY ("yayinlayanBolumId") REFERENCES "DepartmentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifFaaliyet" ADD CONSTRAINT "FifFaaliyet_fifId_fkey" FOREIGN KEY ("fifId") REFERENCES "Fif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifEtkinlik" ADD CONSTRAINT "FifEtkinlik_fifId_fkey" FOREIGN KEY ("fifId") REFERENCES "Fif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifKokNeden" ADD CONSTRAINT "FifKokNeden_fifId_fkey" FOREIGN KEY ("fifId") REFERENCES "Fif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifBesNeden" ADD CONSTRAINT "FifBesNeden_fifId_fkey" FOREIGN KEY ("fifId") REFERENCES "Fif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifEk" ADD CONSTRAINT "FifEk_fifId_fkey" FOREIGN KEY ("fifId") REFERENCES "Fif"("id") ON DELETE CASCADE ON UPDATE CASCADE;


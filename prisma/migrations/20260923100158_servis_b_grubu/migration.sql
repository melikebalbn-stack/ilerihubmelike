-- CreateEnum
CREATE TYPE "ServisSikayetKategori" AS ENUM ('GEC_GELME', 'DURAGA_UGRAMAMA', 'SURUCU_DAVRANISI', 'TEHLIKELI_KULLANIM', 'HIZ_IHLALI', 'TEMIZLIK', 'KLIMA_ISITMA', 'EMNIYET_KEMERI', 'ARAC_ARIZASI', 'FAZLA_YOLCU', 'YANLIS_GUZERGAH', 'SAAT_UYUMSUZLUGU', 'DIGER');

-- CreateEnum
CREATE TYPE "ServisSikayetKaynagi" AS ENUM ('IV', 'PERSONEL');

-- CreateEnum
CREATE TYPE "ServisSikayetDurumu" AS ENUM ('ACIK', 'AKSIYON_ALINDI', 'KAPANDI', 'REDDEDILDI');

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "ikametAdresiDegisimTarihi" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "servis_listesi_revizyonu" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "donemYil" INTEGER NOT NULL,
    "donemAy" INTEGER NOT NULL,
    "revizyonNo" INTEGER NOT NULL,
    "etiket" TEXT NOT NULL,
    "tarihItibariyla" DATE NOT NULL,
    "olusturanId" TEXT NOT NULL,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "degisiklikNotu" TEXT,
    "degisiklikOzeti" JSONB,
    "filtreOzeti" JSONB,
    "parentId" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "servis_listesi_revizyonu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servis_listesi_revizyonu_satiri" (
    "id" TEXT NOT NULL,
    "revizyonId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "sicilNo" TEXT,
    "adSoyad" TEXT NOT NULL,
    "bolum" TEXT,
    "guzergahKod" TEXT NOT NULL,
    "guzergahAd" TEXT NOT NULL,
    "durakKod" TEXT,
    "durakAd" TEXT,
    "sabahSaati" TEXT,
    "telefon" TEXT,

    CONSTRAINT "servis_listesi_revizyonu_satiri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servis_sikayet" (
    "id" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "tarih" DATE NOT NULL,
    "bildirimTarihi" DATE NOT NULL,
    "kategori" "ServisSikayetKategori" NOT NULL,
    "aciklama" TEXT NOT NULL,
    "guzergahId" TEXT NOT NULL,
    "dilimId" TEXT,
    "firmaId" TEXT,
    "aracId" TEXT,
    "soforId" TEXT,
    "plaka" TEXT,
    "soforAdSoyad" TEXT,
    "firmaAd" TEXT,
    "sorumluAdSoyad" TEXT,
    "planlananSaat" TEXT,
    "sikayetciPersonnelId" TEXT,
    "kaynak" "ServisSikayetKaynagi" NOT NULL,
    "sorumluId" TEXT,
    "termin" DATE,
    "durum" "ServisSikayetDurumu" NOT NULL DEFAULT 'ACIK',
    "aksiyon" TEXT,
    "aksiyonTarihi" TIMESTAMP(3),
    "kapanisTarihi" TIMESTAMP(3),
    "kapanisNotu" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servis_sikayet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servis_listesi_revizyonu_firmaId_donemYil_donemAy_idx" ON "servis_listesi_revizyonu"("firmaId", "donemYil", "donemAy");

-- CreateIndex
CREATE INDEX "servis_listesi_revizyonu_isLatest_idx" ON "servis_listesi_revizyonu"("isLatest");

-- CreateIndex
CREATE INDEX "servis_listesi_revizyonu_parentId_idx" ON "servis_listesi_revizyonu"("parentId");

-- CreateIndex
CREATE INDEX "servis_listesi_revizyonu_olusturanId_idx" ON "servis_listesi_revizyonu"("olusturanId");

-- CreateIndex
CREATE UNIQUE INDEX "servis_listesi_revizyonu_firmaId_donemYil_donemAy_revizyonN_key" ON "servis_listesi_revizyonu"("firmaId", "donemYil", "donemAy", "revizyonNo");

-- CreateIndex
CREATE INDEX "servis_listesi_revizyonu_satiri_revizyonId_idx" ON "servis_listesi_revizyonu_satiri"("revizyonId");

-- CreateIndex
CREATE INDEX "servis_listesi_revizyonu_satiri_personnelId_idx" ON "servis_listesi_revizyonu_satiri"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "servis_sikayet_no_key" ON "servis_sikayet"("no");

-- CreateIndex
CREATE INDEX "servis_sikayet_firmaId_bildirimTarihi_idx" ON "servis_sikayet"("firmaId", "bildirimTarihi");

-- CreateIndex
CREATE INDEX "servis_sikayet_guzergahId_bildirimTarihi_idx" ON "servis_sikayet"("guzergahId", "bildirimTarihi");

-- CreateIndex
CREATE INDEX "servis_sikayet_soforId_bildirimTarihi_idx" ON "servis_sikayet"("soforId", "bildirimTarihi");

-- CreateIndex
CREATE INDEX "servis_sikayet_aracId_bildirimTarihi_idx" ON "servis_sikayet"("aracId", "bildirimTarihi");

-- CreateIndex
CREATE INDEX "servis_sikayet_durum_idx" ON "servis_sikayet"("durum");

-- CreateIndex
CREATE INDEX "servis_sikayet_kategori_idx" ON "servis_sikayet"("kategori");

-- CreateIndex
CREATE INDEX "servis_sikayet_bildirimTarihi_idx" ON "servis_sikayet"("bildirimTarihi");

-- CreateIndex
CREATE INDEX "servis_sikayet_dilimId_idx" ON "servis_sikayet"("dilimId");

-- CreateIndex
CREATE INDEX "servis_sikayet_sikayetciPersonnelId_idx" ON "servis_sikayet"("sikayetciPersonnelId");

-- CreateIndex
CREATE INDEX "servis_sikayet_sorumluId_idx" ON "servis_sikayet"("sorumluId");

-- CreateIndex
CREATE INDEX "servis_sikayet_createdById_idx" ON "servis_sikayet"("createdById");

-- CreateIndex
CREATE INDEX "servis_sikayet_updatedById_idx" ON "servis_sikayet"("updatedById");

-- AddForeignKey
ALTER TABLE "servis_listesi_revizyonu" ADD CONSTRAINT "servis_listesi_revizyonu_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "servis_firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_listesi_revizyonu" ADD CONSTRAINT "servis_listesi_revizyonu_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_listesi_revizyonu" ADD CONSTRAINT "servis_listesi_revizyonu_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "servis_listesi_revizyonu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_listesi_revizyonu_satiri" ADD CONSTRAINT "servis_listesi_revizyonu_satiri_revizyonId_fkey" FOREIGN KEY ("revizyonId") REFERENCES "servis_listesi_revizyonu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_listesi_revizyonu_satiri" ADD CONSTRAINT "servis_listesi_revizyonu_satiri_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_guzergahId_fkey" FOREIGN KEY ("guzergahId") REFERENCES "servis_guzergah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_dilimId_fkey" FOREIGN KEY ("dilimId") REFERENCES "servis_sefer_dilimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "servis_firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "servis_arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "servis_sofor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_sikayetciPersonnelId_fkey" FOREIGN KEY ("sikayetciPersonnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


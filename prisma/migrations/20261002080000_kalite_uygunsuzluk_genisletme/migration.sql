-- Kalite Uygunsuzluk (KAL-KYT-15) genisletmesi — Melike'nin eskiz alanlari.
-- Tamamen additive: nullable kolonlar + 3 yeni tablo. DROP / RENAME / NOT NULL yok.

-- AlterTable
ALTER TABLE "KaliteUygunsuzluk" ADD COLUMN     "geciciAksiyon" TEXT,
ADD COLUMN     "kacisKokNedeni" TEXT,
ADD COLUMN     "musteriAdi" TEXT,
ADD COLUMN     "ogrenilmisDersler" TEXT[],
ADD COLUMN     "onaylayanId" TEXT;

-- AlterTable
ALTER TABLE "KaliteUygunsuzlukSatir" ADD COLUMN     "hurdaAdedi" INTEGER;

-- CreateTable
CREATE TABLE "KaliteUygunsuzlukDosya" (
    "id" TEXT NOT NULL,
    "uygunsuzlukId" TEXT NOT NULL,
    "dosyaAdi" TEXT NOT NULL,
    "dosyaUrl" TEXT NOT NULL,
    "dosyaTipi" TEXT,
    "dosyaBoyutu" INTEGER,
    "yukleyenId" TEXT,
    "yuklemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaliteUygunsuzlukDosya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaliteUygunsuzlukTarihGecmisi" (
    "id" TEXT NOT NULL,
    "uygunsuzlukId" TEXT NOT NULL,
    "alanAdi" TEXT NOT NULL,
    "eskiDeger" TIMESTAMP(3),
    "yeniDeger" TIMESTAMP(3),
    "degistirenId" TEXT,
    "degistirmeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaliteUygunsuzlukTarihGecmisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaliteUygunsuzlukKatilimci" (
    "id" TEXT NOT NULL,
    "uygunsuzlukId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "ekleyenTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaliteUygunsuzlukKatilimci_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukDosya_uygunsuzlukId_idx" ON "KaliteUygunsuzlukDosya"("uygunsuzlukId");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukTarihGecmisi_uygunsuzlukId_idx" ON "KaliteUygunsuzlukTarihGecmisi"("uygunsuzlukId");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukKatilimci_uygunsuzlukId_idx" ON "KaliteUygunsuzlukKatilimci"("uygunsuzlukId");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukKatilimci_personnelId_idx" ON "KaliteUygunsuzlukKatilimci"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "KaliteUygunsuzlukKatilimci_uygunsuzlukId_personnelId_key" ON "KaliteUygunsuzlukKatilimci"("uygunsuzlukId", "personnelId");

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzluk" ADD CONSTRAINT "KaliteUygunsuzluk_onaylayanId_fkey" FOREIGN KEY ("onaylayanId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukDosya" ADD CONSTRAINT "KaliteUygunsuzlukDosya_uygunsuzlukId_fkey" FOREIGN KEY ("uygunsuzlukId") REFERENCES "KaliteUygunsuzluk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukTarihGecmisi" ADD CONSTRAINT "KaliteUygunsuzlukTarihGecmisi_uygunsuzlukId_fkey" FOREIGN KEY ("uygunsuzlukId") REFERENCES "KaliteUygunsuzluk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukKatilimci" ADD CONSTRAINT "KaliteUygunsuzlukKatilimci_uygunsuzlukId_fkey" FOREIGN KEY ("uygunsuzlukId") REFERENCES "KaliteUygunsuzluk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukKatilimci" ADD CONSTRAINT "KaliteUygunsuzlukKatilimci_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

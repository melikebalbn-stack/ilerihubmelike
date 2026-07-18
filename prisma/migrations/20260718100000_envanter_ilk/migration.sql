-- CreateEnum
CREATE TYPE "EnvanterUrunTipi" AS ENUM ('STANDART_STOK', 'PERIYODIK_TUKETIM', 'NUMARALI_URUN', 'ZIMMETLI_URUN', 'BEDENLI_URUN', 'KKD_URUNU');

-- CreateEnum
CREATE TYPE "EnvanterDurum" AS ENUM ('AKTIF', 'PASIF', 'ARSIV');

-- CreateEnum
CREATE TYPE "EnvanterVaryantTipi" AS ENUM ('YOK', 'BEDEN', 'NUMARA', 'RENK', 'BEDEN_RENK', 'NUMARA_RENK');

-- CreateEnum
CREATE TYPE "EnvanterStokDurum" AS ENUM ('NORMAL', 'MINIMUM', 'KRITIK', 'EKSIK');

-- CreateEnum
CREATE TYPE "EnvanterHareketTipi" AS ENUM ('GIRIS', 'CIKIS', 'ZIMMET', 'IADE', 'HURDA', 'SAYIM_DUZELTME');

-- CreateTable
CREATE TABLE "envanter_urun" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kategori" TEXT,
    "tip" "EnvanterUrunTipi" NOT NULL DEFAULT 'STANDART_STOK',
    "olcuBirimi" TEXT NOT NULL DEFAULT 'ADET',
    "barkod" TEXT,
    "aciklama" TEXT,
    "varyantTipi" "EnvanterVaryantTipi" NOT NULL DEFAULT 'YOK',
    "durum" "EnvanterDurum" NOT NULL DEFAULT 'AKTIF',
    "tedarikci" TEXT,
    "marka" TEXT,
    "model" TEXT,
    "sonAlisFiyati" DECIMAL(12,2),
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "kdvOrani" INTEGER,
    "minSiparisMiktari" INTEGER,
    "tedarikSuresiGun" INTEGER,
    "dagitimSekli" TEXT,
    "periyot" TEXT,
    "kullanimOmruGun" INTEGER,
    "teslimYetkisi" TEXT,
    "sureSonuAksiyonu" TEXT,
    "dagitimKurali" TEXT,
    "eskiUrunIade" BOOLEAN NOT NULL DEFAULT false,
    "yoneticiOnayi" BOOLEAN NOT NULL DEFAULT false,
    "aciklamaZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "fotoZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "imzaZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "qrZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "barkodZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "hedefYaka" TEXT,
    "hedefBolum" TEXT,
    "hedefPozisyon" TEXT,
    "hedefLokasyon" TEXT,
    "hedefVardiya" TEXT,
    "calismaSekli" TEXT,
    "personelHedefTipi" TEXT,
    "atamaTipi" TEXT,
    "tahminiDagitim" TEXT,
    "sonrakiDagitimTarihi" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_urun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_urun_varyant" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "varyantAdi" TEXT NOT NULL,
    "beden" TEXT,
    "numara" TEXT,
    "renk" TEXT,
    "barkod" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_urun_varyant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_stok" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "varyantId" TEXT,
    "mevcut" INTEGER NOT NULL DEFAULT 0,
    "minStok" INTEGER,
    "kritikStok" INTEGER,
    "maxStok" INTEGER,
    "depo" TEXT,
    "raf" TEXT,
    "durum" "EnvanterStokDurum" NOT NULL DEFAULT 'EKSIK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_stok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_stok_hareket" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "varyantId" TEXT,
    "hareketTipi" "EnvanterHareketTipi" NOT NULL,
    "miktar" INTEGER NOT NULL,
    "depo" TEXT,
    "raf" TEXT,
    "aciklama" TEXT,
    "personnelId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envanter_stok_hareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_urun_personel_hedef" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envanter_urun_personel_hedef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envanter_urun_kod_key" ON "envanter_urun"("kod");

-- CreateIndex
CREATE INDEX "envanter_urun_kod_idx" ON "envanter_urun"("kod");

-- CreateIndex
CREATE INDEX "envanter_urun_kategori_idx" ON "envanter_urun"("kategori");

-- CreateIndex
CREATE INDEX "envanter_urun_durum_idx" ON "envanter_urun"("durum");

-- CreateIndex
CREATE INDEX "envanter_urun_varyant_urunId_idx" ON "envanter_urun_varyant"("urunId");

-- CreateIndex
CREATE INDEX "envanter_urun_varyant_aktif_idx" ON "envanter_urun_varyant"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "envanter_urun_varyant_urunId_varyantAdi_key" ON "envanter_urun_varyant"("urunId", "varyantAdi");

-- CreateIndex
CREATE INDEX "envanter_stok_urunId_idx" ON "envanter_stok"("urunId");

-- CreateIndex
CREATE INDEX "envanter_stok_varyantId_idx" ON "envanter_stok"("varyantId");

-- CreateIndex
CREATE INDEX "envanter_stok_durum_idx" ON "envanter_stok"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "envanter_stok_urunId_varyantId_depo_raf_key" ON "envanter_stok"("urunId", "varyantId", "depo", "raf");

-- CreateIndex
CREATE INDEX "envanter_stok_hareket_urunId_idx" ON "envanter_stok_hareket"("urunId");

-- CreateIndex
CREATE INDEX "envanter_stok_hareket_varyantId_idx" ON "envanter_stok_hareket"("varyantId");

-- CreateIndex
CREATE INDEX "envanter_stok_hareket_hareketTipi_idx" ON "envanter_stok_hareket"("hareketTipi");

-- CreateIndex
CREATE INDEX "envanter_stok_hareket_personnelId_idx" ON "envanter_stok_hareket"("personnelId");

-- CreateIndex
CREATE INDEX "envanter_urun_personel_hedef_urunId_idx" ON "envanter_urun_personel_hedef"("urunId");

-- CreateIndex
CREATE INDEX "envanter_urun_personel_hedef_personnelId_idx" ON "envanter_urun_personel_hedef"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "envanter_urun_personel_hedef_urunId_personnelId_key" ON "envanter_urun_personel_hedef"("urunId", "personnelId");

-- AddForeignKey
ALTER TABLE "envanter_urun_varyant" ADD CONSTRAINT "envanter_urun_varyant_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "envanter_urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_stok" ADD CONSTRAINT "envanter_stok_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "envanter_urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_stok" ADD CONSTRAINT "envanter_stok_varyantId_fkey" FOREIGN KEY ("varyantId") REFERENCES "envanter_urun_varyant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_stok_hareket" ADD CONSTRAINT "envanter_stok_hareket_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "envanter_urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_stok_hareket" ADD CONSTRAINT "envanter_stok_hareket_varyantId_fkey" FOREIGN KEY ("varyantId") REFERENCES "envanter_urun_varyant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_urun_personel_hedef" ADD CONSTRAINT "envanter_urun_personel_hedef_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "envanter_urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

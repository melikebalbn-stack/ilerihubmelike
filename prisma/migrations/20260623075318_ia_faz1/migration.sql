-- CreateEnum
CREATE TYPE "IaYaka" AS ENUM ('MAVI', 'BEYAZ', 'GRI');

-- CreateEnum
CREATE TYPE "IaYetkinlikTipi" AS ENUM ('GENEL', 'MESLEKI');

-- CreateEnum
CREATE TYPE "IaDurum" AS ENUM ('TASLAK', 'AMIR_ONAYINDA', 'IK_INCELEMESINDE', 'ONAYLANDI', 'REVIZE_ISTENDI');

-- CreateEnum
CREATE TYPE "IaSiklik" AS ENUM ('GUNLUK', 'HAFTALIK', 'AYLIK', 'DONEMSEL', 'YILLIK');

-- CreateEnum
CREATE TYPE "IaYetkiTipi" AS ENUM ('TEK_BASINA', 'AMIR_ONAYI', 'MUDUR_ONAYI', 'GM_ONAYI');

-- CreateEnum
CREATE TYPE "IaIliskiTipi" AS ENUM ('IS_ALIR', 'IS_VERIR', 'RAPORLAR', 'KONTROL_EDEN', 'BIRLIKTE');

-- CreateEnum
CREATE TYPE "IaEsneklikTipi" AS ENUM ('YAPABILDIGIM_IS', 'YEDEGIM');

-- CreateEnum
CREATE TYPE "IaEgitimOncelik" AS ENUM ('ACIL', 'NORMAL');

-- CreateEnum
CREATE TYPE "IaEgitimTipi" AS ENUM ('IC', 'DIS');

-- CreateEnum
CREATE TYPE "IaEgitimDurum" AS ENUM ('PLANLANMADI', 'PLANLANDI', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "IaGelisimModeli" AS ENUM ('IS_BASI', 'SOSYAL', 'FORMEL');

-- CreateEnum
CREATE TYPE "IaAksiyonDurum" AS ENUM ('PLANLANDI', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateTable
CREATE TABLE "ia_pozisyon" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "yaka" "IaYaka" NOT NULL,
    "ustPozisyonId" TEXT,
    "isAilesiId" TEXT,
    "ucretBandiId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_pozisyon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_yetkinlik" (
    "id" TEXT NOT NULL,
    "tip" "IaYetkinlikTipi" NOT NULL DEFAULT 'MESLEKI',
    "grup" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "makineKodu" TEXT,
    "yakaTipi" "IaYaka" NOT NULL,
    "bolum" TEXT,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_yetkinlik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_pozisyon_yetkinlik" (
    "id" TEXT NOT NULL,
    "pozisyonId" TEXT NOT NULL,
    "yetkinlikId" TEXT NOT NULL,
    "hedefSeviye" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "ia_pozisyon_yetkinlik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_is_analizi" (
    "id" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "sicilNo" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "pozisyonId" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "amir" TEXT,
    "durum" "IaDurum" NOT NULL DEFAULT 'TASLAK',
    "yaka" "IaYaka" NOT NULL,
    "amirOnayTarihi" TIMESTAMP(3),
    "amirNotu" TEXT,
    "ikOnayTarihi" TIMESTAMP(3),
    "ikNotu" TEXT,
    "zorlukKonusu" TEXT,
    "iyilestirmeOneri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_is_analizi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_yapilan_is" (
    "id" TEXT NOT NULL,
    "analizId" TEXT NOT NULL,
    "isAdi" TEXT NOT NULL,
    "tetikleyici" TEXT,
    "makineArac" TEXT,
    "siklik" "IaSiklik" NOT NULL,
    "sureDakika" INTEGER,
    "zamanYuzde" INTEGER,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ia_yapilan_is_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_analiz_yetkinlik" (
    "id" TEXT NOT NULL,
    "analizId" TEXT NOT NULL,
    "yetkinlikId" TEXT NOT NULL,
    "mevcutSeviye" INTEGER,
    "hedefSeviye" INTEGER,

    CONSTRAINT "ia_analiz_yetkinlik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_karar_yetkisi" (
    "id" TEXT NOT NULL,
    "analizId" TEXT NOT NULL,
    "konu" TEXT NOT NULL,
    "yetkiTipi" "IaYetkiTipi" NOT NULL,

    CONSTRAINT "ia_karar_yetkisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_is_iliskisi" (
    "id" TEXT NOT NULL,
    "analizId" TEXT NOT NULL,
    "tip" "IaIliskiTipi" NOT NULL,
    "taraf" TEXT NOT NULL,
    "aciklama" TEXT,

    CONSTRAINT "ia_is_iliskisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_esneklik" (
    "id" TEXT NOT NULL,
    "analizId" TEXT NOT NULL,
    "tip" "IaEsneklikTipi" NOT NULL,
    "kisiPozIs" TEXT NOT NULL,

    CONSTRAINT "ia_esneklik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_gorev_tanimi" (
    "id" TEXT NOT NULL,
    "pozisyonId" TEXT NOT NULL,
    "versiyon" INTEGER NOT NULL DEFAULT 1,
    "durum" "IaDurum" NOT NULL DEFAULT 'TASLAK',
    "amac" TEXT,
    "anaSorumluluklar" TEXT,
    "raporlamaIliskisi" TEXT,
    "arananYetkinlik" TEXT,
    "egitimGereksinim" TEXT,
    "kaliteSorumluluk" TEXT,
    "isgSorumluluk" TEXT,
    "performansKpi" TEXT,
    "yetkiSinirlari" TEXT,
    "kisilikProfili" TEXT,
    "notlar" TEXT,
    "onaylayanId" TEXT,
    "onayTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_gorev_tanimi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_yetkinlik_donem" (
    "id" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "sicilNo" TEXT NOT NULL,
    "yetkinlikId" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "donem" TEXT NOT NULL,
    "hedefSeviye" INTEGER NOT NULL,
    "mevcutSeviye" INTEGER NOT NULL,
    "olcumTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olcenKisi" TEXT,

    CONSTRAINT "ia_yetkinlik_donem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_egitim_ihtiyaci" (
    "id" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "sicilNo" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "yetkinlikId" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "donem" TEXT NOT NULL,
    "oncelik" "IaEgitimOncelik" NOT NULL DEFAULT 'NORMAL',
    "egitimTipi" "IaEgitimTipi" NOT NULL DEFAULT 'IC',
    "durum" "IaEgitimDurum" NOT NULL DEFAULT 'PLANLANMADI',
    "planlananTarih" TIMESTAMP(3),
    "gerceklesenTarih" TIMESTAMP(3),
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_egitim_ihtiyaci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_gelisim_aksiyonu" (
    "id" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "sicilNo" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "yetkinlikId" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "mevcutSeviye" INTEGER NOT NULL,
    "hedefSeviye" INTEGER NOT NULL,
    "aksiyon" TEXT NOT NULL,
    "model702010" "IaGelisimModeli" NOT NULL,
    "yontem" TEXT,
    "baslangic" TIMESTAMP(3),
    "bitis" TIMESTAMP(3),
    "durum" "IaAksiyonDurum" NOT NULL DEFAULT 'PLANLANDI',
    "ilerleme" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_gelisim_aksiyonu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_is_ailesi" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "kademeSayisi" INTEGER NOT NULL DEFAULT 1,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_is_ailesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_performans_donem" (
    "id" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "sicilNo" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "pozisyonId" TEXT NOT NULL,
    "donem" TEXT NOT NULL,
    "hedefPuani" DOUBLE PRECISION,
    "yetkinlikPuani" DOUBLE PRECISION,
    "genelPuan" DOUBLE PRECISION,
    "degerlendiren" TEXT,
    "notlar" TEXT,
    "durum" "IaDurum" NOT NULL DEFAULT 'TASLAK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_performans_donem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_kariyer_yolu" (
    "id" TEXT NOT NULL,
    "kaynakPozisyonId" TEXT NOT NULL,
    "hedefPozisyonId" TEXT NOT NULL,
    "gerekenSure" INTEGER,
    "gerekenYetkinlik" TEXT,
    "aciklama" TEXT,

    CONSTRAINT "ia_kariyer_yolu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_ucret_bandi" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "isAilesi" TEXT,
    "kademe" INTEGER NOT NULL DEFAULT 1,
    "altLimit" DOUBLE PRECISION,
    "ustLimit" DOUBLE PRECISION,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_ucret_bandi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ia_pozisyon_ad_bolum_key" ON "ia_pozisyon"("ad", "bolum");

-- CreateIndex
CREATE UNIQUE INDEX "ia_yetkinlik_grup_ad_bolum_key" ON "ia_yetkinlik"("grup", "ad", "bolum");

-- CreateIndex
CREATE UNIQUE INDEX "ia_pozisyon_yetkinlik_pozisyonId_yetkinlikId_key" ON "ia_pozisyon_yetkinlik"("pozisyonId", "yetkinlikId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_analiz_yetkinlik_analizId_yetkinlikId_key" ON "ia_analiz_yetkinlik"("analizId", "yetkinlikId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_gorev_tanimi_pozisyonId_key" ON "ia_gorev_tanimi"("pozisyonId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_yetkinlik_donem_personelId_yetkinlikId_donem_key" ON "ia_yetkinlik_donem"("personelId", "yetkinlikId", "donem");

-- CreateIndex
CREATE UNIQUE INDEX "ia_is_ailesi_ad_key" ON "ia_is_ailesi"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "ia_performans_donem_personelId_donem_key" ON "ia_performans_donem"("personelId", "donem");

-- CreateIndex
CREATE UNIQUE INDEX "ia_kariyer_yolu_kaynakPozisyonId_hedefPozisyonId_key" ON "ia_kariyer_yolu"("kaynakPozisyonId", "hedefPozisyonId");

-- AddForeignKey
ALTER TABLE "ia_pozisyon" ADD CONSTRAINT "ia_pozisyon_ustPozisyonId_fkey" FOREIGN KEY ("ustPozisyonId") REFERENCES "ia_pozisyon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_pozisyon" ADD CONSTRAINT "ia_pozisyon_isAilesiId_fkey" FOREIGN KEY ("isAilesiId") REFERENCES "ia_is_ailesi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_pozisyon" ADD CONSTRAINT "ia_pozisyon_ucretBandiId_fkey" FOREIGN KEY ("ucretBandiId") REFERENCES "ia_ucret_bandi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_pozisyon_yetkinlik" ADD CONSTRAINT "ia_pozisyon_yetkinlik_pozisyonId_fkey" FOREIGN KEY ("pozisyonId") REFERENCES "ia_pozisyon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_pozisyon_yetkinlik" ADD CONSTRAINT "ia_pozisyon_yetkinlik_yetkinlikId_fkey" FOREIGN KEY ("yetkinlikId") REFERENCES "ia_yetkinlik"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_is_analizi" ADD CONSTRAINT "ia_is_analizi_pozisyonId_fkey" FOREIGN KEY ("pozisyonId") REFERENCES "ia_pozisyon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_yapilan_is" ADD CONSTRAINT "ia_yapilan_is_analizId_fkey" FOREIGN KEY ("analizId") REFERENCES "ia_is_analizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_analiz_yetkinlik" ADD CONSTRAINT "ia_analiz_yetkinlik_analizId_fkey" FOREIGN KEY ("analizId") REFERENCES "ia_is_analizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_karar_yetkisi" ADD CONSTRAINT "ia_karar_yetkisi_analizId_fkey" FOREIGN KEY ("analizId") REFERENCES "ia_is_analizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_is_iliskisi" ADD CONSTRAINT "ia_is_iliskisi_analizId_fkey" FOREIGN KEY ("analizId") REFERENCES "ia_is_analizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_esneklik" ADD CONSTRAINT "ia_esneklik_analizId_fkey" FOREIGN KEY ("analizId") REFERENCES "ia_is_analizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_gorev_tanimi" ADD CONSTRAINT "ia_gorev_tanimi_pozisyonId_fkey" FOREIGN KEY ("pozisyonId") REFERENCES "ia_pozisyon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_yetkinlik_donem" ADD CONSTRAINT "ia_yetkinlik_donem_yetkinlikId_fkey" FOREIGN KEY ("yetkinlikId") REFERENCES "ia_yetkinlik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_egitim_ihtiyaci" ADD CONSTRAINT "ia_egitim_ihtiyaci_yetkinlikId_fkey" FOREIGN KEY ("yetkinlikId") REFERENCES "ia_yetkinlik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_gelisim_aksiyonu" ADD CONSTRAINT "ia_gelisim_aksiyonu_yetkinlikId_fkey" FOREIGN KEY ("yetkinlikId") REFERENCES "ia_yetkinlik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_kariyer_yolu" ADD CONSTRAINT "ia_kariyer_yolu_kaynakPozisyonId_fkey" FOREIGN KEY ("kaynakPozisyonId") REFERENCES "ia_pozisyon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_kariyer_yolu" ADD CONSTRAINT "ia_kariyer_yolu_hedefPozisyonId_fkey" FOREIGN KEY ("hedefPozisyonId") REFERENCES "ia_pozisyon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

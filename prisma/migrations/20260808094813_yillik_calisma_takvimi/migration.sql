-- CreateEnum
CREATE TYPE "YillikTakvimDurum" AS ENUM ('TASLAK', 'PLANLANDI', 'DEVAM_EDIYOR', 'YAKLASIYOR', 'GECIKTI', 'TAMAMLANDI', 'TAMAMLANDI_ONAY_BEKLIYOR', 'ONAYLANDI', 'REVIZYON_ISTENDI', 'ERTELENDI', 'IPTAL_EDILDI', 'ASKIYA_ALINDI');

-- CreateEnum
CREATE TYPE "YillikTakvimKayitTuru" AS ENUM ('SON_TARIH', 'TUM_GUN_ETKINLIK', 'SAATLI_ETKINLIK', 'TOPLANTI', 'TEAMS_TOPLANTISI', 'EGITIM', 'DENETIM', 'KONTROL', 'HATIRLATMA');

-- CreateEnum
CREATE TYPE "YillikTakvimOncelik" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK');

-- CreateEnum
CREATE TYPE "YillikTakvimPeriyot" AS ENUM ('TEK_SEFERLIK', 'GUNLUK', 'HAFTALIK', 'IKI_HAFTADA_BIR', 'AYLIK', 'IKI_AYDA_BIR', 'UC_AYLIK', 'ALTI_AYLIK', 'YILLIK', 'IKI_YILDA_BIR', 'UC_YILDA_BIR', 'BELIRLI_AYLAR', 'BELIRLI_TARIHLER', 'OZEL');

-- CreateEnum
CREATE TYPE "YillikTakvimKatilimciRol" AS ENUM ('ANA_SORUMLU', 'YEDEK_SORUMLU', 'DESTEK', 'ONAYLAYAN', 'IKINCI_ONAYLAYAN', 'BILGILENDIRILECEK', 'GOZLEMCI');

-- CreateEnum
CREATE TYPE "YillikTakvimGerceklesmeDurumu" AS ENUM ('BEKLIYOR', 'GERCEKLESTI', 'GERCEKLESMEDI', 'DEVREDILDI', 'PLANDISI');

-- CreateEnum
CREATE TYPE "YillikTakvimOnayKarari" AS ENUM ('ONAYLANDI', 'REVIZYON_ISTENDI');

-- CreateTable
CREATE TABLE "YillikTakvimKaydi" (
    "id" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "departmentId" TEXT,
    "anaKonu" TEXT NOT NULL,
    "surec" TEXT NOT NULL,
    "kisaBaslik" TEXT,
    "aciklama" TEXT,
    "oncelik" "YillikTakvimOncelik" NOT NULL DEFAULT 'ORTA',
    "kayitTuru" "YillikTakvimKayitTuru" NOT NULL DEFAULT 'SON_TARIH',
    "periyot" "YillikTakvimPeriyot" NOT NULL DEFAULT 'YILLIK',
    "durum" "YillikTakvimDurum" NOT NULL DEFAULT 'TASLAK',
    "etiketler" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lokasyon" TEXT,
    "mevzuatStandart" TEXT,
    "disKurum" TEXT,
    "referansNo" TEXT,
    "tumGunMu" BOOLEAN NOT NULL DEFAULT true,
    "baslangicTarihi" TIMESTAMP(3),
    "bitisTarihi" TIMESTAMP(3),
    "hatirlatmaBaslangici" TIMESTAMP(3),
    "plananUygulamaTarihi" TIMESTAMP(3),
    "nihaiSonTarih" TIMESTAMP(3),
    "sonrakiKontrolTarihi" TIMESTAMP(3),
    "gecerlilikBaslangici" TIMESTAMP(3),
    "gecerlilikBitisi" TIMESTAMP(3),
    "onayGerekli" BOOLEAN NOT NULL DEFAULT false,
    "kanitZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "iptalMi" BOOLEAN NOT NULL DEFAULT false,
    "arsivMi" BOOLEAN NOT NULL DEFAULT false,
    "kaynakModul" TEXT,
    "kaynakKayitId" TEXT,
    "gerceklesmeTarihi" TIMESTAMP(3),
    "gerceklesmeDurumu" "YillikTakvimGerceklesmeDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "gerceklesmemeNedeni" TEXT,
    "oncekiKayitId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YillikTakvimKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimKatilimci" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rol" "YillikTakvimKatilimciRol" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimKatilimci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimChecklist" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "sorumluId" TEXT,
    "sonTarih" TIMESTAMP(3),
    "zorunlu" BOOLEAN NOT NULL DEFAULT false,
    "kanitGerekli" BOOLEAN NOT NULL DEFAULT false,
    "tamamlandi" BOOLEAN NOT NULL DEFAULT false,
    "tamamlayanId" TEXT,
    "tamamlanmaTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimEk" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "dosyaTuru" TEXT NOT NULL,
    "dosyaAdi" TEXT NOT NULL,
    "saklamaYolu" TEXT NOT NULL,
    "boyut" INTEGER,
    "yukleyenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimEk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimBildirimKurali" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "tetik" TEXT NOT NULL,
    "aliciRoller" "YillikTakvimKatilimciRol"[] DEFAULT ARRAY[]::"YillikTakvimKatilimciRol"[],
    "kanal" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "YillikTakvimBildirimKurali_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimBildirimLog" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "tetik" TEXT NOT NULL,
    "aliciUserId" TEXT,
    "aliciEposta" TEXT,
    "kanal" TEXT NOT NULL,
    "sonuc" TEXT NOT NULL,
    "hataMesaji" TEXT,
    "gonderimGunu" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimBildirimLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimIslemGecmisi" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "islemTuru" TEXT NOT NULL,
    "alan" TEXT,
    "eskiDeger" TEXT,
    "yeniDeger" TEXT,
    "yapanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimIslemGecmisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimOnayKademesi" (
    "id" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "unvan" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimOnayKademesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YillikTakvimOnayAdimi" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "tur" INTEGER NOT NULL DEFAULT 1,
    "adimSira" INTEGER NOT NULL,
    "unvan" TEXT NOT NULL,
    "onaylayanId" TEXT,
    "karar" "YillikTakvimOnayKarari",
    "yorum" TEXT,
    "kararTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YillikTakvimOnayAdimi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YillikTakvimKaydi_yil_departmentId_idx" ON "YillikTakvimKaydi"("yil", "departmentId");

-- CreateIndex
CREATE INDEX "YillikTakvimKaydi_durum_idx" ON "YillikTakvimKaydi"("durum");

-- CreateIndex
CREATE INDEX "YillikTakvimKaydi_nihaiSonTarih_idx" ON "YillikTakvimKaydi"("nihaiSonTarih");

-- CreateIndex
CREATE UNIQUE INDEX "YillikTakvimKaydi_kaynakModul_kaynakKayitId_key" ON "YillikTakvimKaydi"("kaynakModul", "kaynakKayitId");

-- CreateIndex
CREATE INDEX "YillikTakvimKatilimci_userId_idx" ON "YillikTakvimKatilimci"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "YillikTakvimKatilimci_kayitId_userId_rol_key" ON "YillikTakvimKatilimci"("kayitId", "userId", "rol");

-- CreateIndex
CREATE INDEX "YillikTakvimChecklist_kayitId_idx" ON "YillikTakvimChecklist"("kayitId");

-- CreateIndex
CREATE INDEX "YillikTakvimEk_kayitId_idx" ON "YillikTakvimEk"("kayitId");

-- CreateIndex
CREATE INDEX "YillikTakvimBildirimKurali_kayitId_idx" ON "YillikTakvimBildirimKurali"("kayitId");

-- CreateIndex
CREATE INDEX "YillikTakvimBildirimLog_kayitId_idx" ON "YillikTakvimBildirimLog"("kayitId");

-- CreateIndex
CREATE UNIQUE INDEX "YillikTakvimBildirimLog_kayitId_tetik_aliciEposta_gonderimG_key" ON "YillikTakvimBildirimLog"("kayitId", "tetik", "aliciEposta", "gonderimGunu");

-- CreateIndex
CREATE INDEX "YillikTakvimIslemGecmisi_kayitId_idx" ON "YillikTakvimIslemGecmisi"("kayitId");

-- CreateIndex
CREATE UNIQUE INDEX "YillikTakvimOnayKademesi_sira_key" ON "YillikTakvimOnayKademesi"("sira");

-- CreateIndex
CREATE INDEX "YillikTakvimOnayAdimi_kayitId_idx" ON "YillikTakvimOnayAdimi"("kayitId");

-- AddForeignKey
ALTER TABLE "YillikTakvimKaydi" ADD CONSTRAINT "YillikTakvimKaydi_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimKaydi" ADD CONSTRAINT "YillikTakvimKaydi_oncekiKayitId_fkey" FOREIGN KEY ("oncekiKayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimKaydi" ADD CONSTRAINT "YillikTakvimKaydi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimKaydi" ADD CONSTRAINT "YillikTakvimKaydi_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimKatilimci" ADD CONSTRAINT "YillikTakvimKatilimci_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimKatilimci" ADD CONSTRAINT "YillikTakvimKatilimci_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimChecklist" ADD CONSTRAINT "YillikTakvimChecklist_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimChecklist" ADD CONSTRAINT "YillikTakvimChecklist_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimChecklist" ADD CONSTRAINT "YillikTakvimChecklist_tamamlayanId_fkey" FOREIGN KEY ("tamamlayanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimEk" ADD CONSTRAINT "YillikTakvimEk_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimEk" ADD CONSTRAINT "YillikTakvimEk_yukleyenId_fkey" FOREIGN KEY ("yukleyenId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimBildirimKurali" ADD CONSTRAINT "YillikTakvimBildirimKurali_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimBildirimLog" ADD CONSTRAINT "YillikTakvimBildirimLog_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimIslemGecmisi" ADD CONSTRAINT "YillikTakvimIslemGecmisi_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimIslemGecmisi" ADD CONSTRAINT "YillikTakvimIslemGecmisi_yapanId_fkey" FOREIGN KEY ("yapanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimOnayKademesi" ADD CONSTRAINT "YillikTakvimOnayKademesi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimOnayAdimi" ADD CONSTRAINT "YillikTakvimOnayAdimi_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "YillikTakvimKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YillikTakvimOnayAdimi" ADD CONSTRAINT "YillikTakvimOnayAdimi_onaylayanId_fkey" FOREIGN KEY ("onaylayanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


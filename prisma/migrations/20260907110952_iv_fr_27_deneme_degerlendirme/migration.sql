-- CreateEnum
CREATE TYPE "DenemeTur" AS ENUM ('DENEME_2AY', 'ALTI_AY');

-- CreateEnum
CREATE TYPE "DenemeKriterGrup" AS ENUM ('MESLEKI', 'DAVRANISSAL', 'BIREYSEL', 'CALISAN');

-- CreateEnum
CREATE TYPE "DenemeDurum" AS ENUM ('TASLAK', 'DEGERLENDIRICI1_BEKLIYOR', 'MUDUR_YRD_BEKLIYOR', 'MUDUR_BEKLIYOR', 'ONAY_BEKLIYOR', 'IK_BEKLIYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "DenemeDegerlendiriciRol" AS ENUM ('TAKIM_LIDERI', 'MUDUR_YARDIMCISI', 'MUDUR');

-- CreateTable
CREATE TABLE "deneme_kriter" (
    "id" TEXT NOT NULL,
    "revizyon" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "grup" "DenemeKriterGrup" NOT NULL,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deneme_kriter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deneme_degerlendirme" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "tur" "DenemeTur" NOT NULL,
    "hedefTarih" DATE NOT NULL,
    "yakaRengi" TEXT NOT NULL,
    "kriterRevizyon" TEXT NOT NULL,
    "durum" "DenemeDurum" NOT NULL DEFAULT 'TASLAK',
    "degerlendirici1Id" TEXT,
    "degerlendirici1Rol" "DenemeDegerlendiriciRol",
    "degerlendirici2Id" TEXT,
    "degerlendirici2Rol" "DenemeDegerlendiriciRol",
    "degerlendirici1At" TIMESTAMP(3),
    "degerlendirici2At" TIMESTAMP(3),
    "puan1" INTEGER,
    "puan2" INTEGER,
    "ortalama" DOUBLE PRECISION,
    "basarili" BOOLEAN,
    "onaylayanId" TEXT,
    "onayTarihi" TIMESTAMP(3),
    "onayNotu" TEXT,
    "ikKapatanId" TEXT,
    "ikKapatmaTarihi" TIMESTAMP(3),
    "fesihGerekce" TEXT,
    "hatirlatmaSeviyesi" INTEGER NOT NULL DEFAULT 0,
    "sonHatirlatmaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "deneme_degerlendirme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deneme_puan" (
    "id" TEXT NOT NULL,
    "degerlendirmeId" TEXT NOT NULL,
    "kriterId" TEXT NOT NULL,
    "degerlendiriciSira" INTEGER NOT NULL,
    "puan" INTEGER NOT NULL,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deneme_puan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deneme_degerlendirme_log" (
    "id" TEXT NOT NULL,
    "degerlendirmeId" TEXT NOT NULL,
    "eskiDurum" "DenemeDurum",
    "yeniDurum" "DenemeDurum" NOT NULL,
    "aktorId" TEXT,
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deneme_degerlendirme_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deneme_kriter_aktif_sortOrder_idx" ON "deneme_kriter"("aktif", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "deneme_kriter_revizyon_sira_key" ON "deneme_kriter"("revizyon", "sira");

-- CreateIndex
CREATE INDEX "deneme_degerlendirme_durum_idx" ON "deneme_degerlendirme"("durum");

-- CreateIndex
CREATE INDEX "deneme_degerlendirme_hedefTarih_idx" ON "deneme_degerlendirme"("hedefTarih");

-- CreateIndex
CREATE INDEX "deneme_degerlendirme_tur_durum_idx" ON "deneme_degerlendirme"("tur", "durum");

-- CreateIndex
CREATE INDEX "deneme_degerlendirme_degerlendirici1Id_idx" ON "deneme_degerlendirme"("degerlendirici1Id");

-- CreateIndex
CREATE INDEX "deneme_degerlendirme_degerlendirici2Id_idx" ON "deneme_degerlendirme"("degerlendirici2Id");

-- CreateIndex
CREATE UNIQUE INDEX "deneme_degerlendirme_personnelId_tur_key" ON "deneme_degerlendirme"("personnelId", "tur");

-- CreateIndex
CREATE INDEX "deneme_puan_degerlendirmeId_idx" ON "deneme_puan"("degerlendirmeId");

-- CreateIndex
CREATE INDEX "deneme_puan_kriterId_idx" ON "deneme_puan"("kriterId");

-- CreateIndex
CREATE UNIQUE INDEX "deneme_puan_degerlendirmeId_kriterId_degerlendiriciSira_key" ON "deneme_puan"("degerlendirmeId", "kriterId", "degerlendiriciSira");

-- CreateIndex
CREATE INDEX "deneme_degerlendirme_log_degerlendirmeId_createdAt_idx" ON "deneme_degerlendirme_log"("degerlendirmeId", "createdAt");

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme" ADD CONSTRAINT "deneme_degerlendirme_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme" ADD CONSTRAINT "deneme_degerlendirme_degerlendirici1Id_fkey" FOREIGN KEY ("degerlendirici1Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme" ADD CONSTRAINT "deneme_degerlendirme_degerlendirici2Id_fkey" FOREIGN KEY ("degerlendirici2Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme" ADD CONSTRAINT "deneme_degerlendirme_onaylayanId_fkey" FOREIGN KEY ("onaylayanId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme" ADD CONSTRAINT "deneme_degerlendirme_ikKapatanId_fkey" FOREIGN KEY ("ikKapatanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_puan" ADD CONSTRAINT "deneme_puan_degerlendirmeId_fkey" FOREIGN KEY ("degerlendirmeId") REFERENCES "deneme_degerlendirme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_puan" ADD CONSTRAINT "deneme_puan_kriterId_fkey" FOREIGN KEY ("kriterId") REFERENCES "deneme_kriter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme_log" ADD CONSTRAINT "deneme_degerlendirme_log_degerlendirmeId_fkey" FOREIGN KEY ("degerlendirmeId") REFERENCES "deneme_degerlendirme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deneme_degerlendirme_log" ADD CONSTRAINT "deneme_degerlendirme_log_aktorId_fkey" FOREIGN KEY ("aktorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


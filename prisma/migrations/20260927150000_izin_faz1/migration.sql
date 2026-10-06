-- İZİN MODÜLÜ Faz 1 — şema. Plan: "İzin Modülü — Tasarım Planı" §2.
-- ADDITIVE: 5 enum + 6 tablo (izin_turu, izin_talep, izin_talep_gun, izin_onay, izin_bakiye_hareketi,
-- izin_belge). Mevcut tablolardan yalnız pdks_puantaj_gun'a 3 NULLABLE kolon (izinTalepId → izin_talep
-- SET NULL, izinPay, izinEtiketi) ve PdksGunDurum'a IZINLI, RAPORLU (PG14: ADD VALUE transaction içinde
-- olur; bu migration'da KULLANILMAZ). DROP yok.
-- Prod: psql -f --single-transaction + prisma migrate resolve --applied (migrate deploy YASAK).
-- Bölüm 2 (dosya sonu): izin_bakiye_hareketi DEFTERİ değiştirilemez — UPDATE/DELETE/TRUNCATE trigger'ı.
-- UYARI: trigger'lar Prisma şemasında ifade edilemez; sonraki `prisma migrate dev` çıktısında
-- DROP TRIGGER / DROP FUNCTION (ya da pdks_kart kısmi index'leri için DROP INDEX) çıkarsa o satırlar SİLİNMELİ.

-- ===================== Bölüm 1: Prisma migrate diff çıktısı =====================
-- CreateEnum
CREATE TYPE "IzinDurumu" AS ENUM ('BEKLIYOR_YONETICI', 'BEKLIYOR_IV', 'ONAYLANDI', 'REDDEDILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "IzinYarim" AS ENUM ('SABAH', 'OGLEDEN_SONRA');

-- CreateEnum
CREATE TYPE "IzinOnayAkisi" AS ENUM ('YONETICI_IV', 'YALNIZ_IV');

-- CreateEnum
CREATE TYPE "IzinGunSayimi" AS ENUM ('IS_GUNU', 'TAKVIM_GUNU');

-- CreateEnum
CREATE TYPE "IzinHareketTuru" AS ENUM ('HAK_EDIS', 'KULLANIM', 'IPTAL_IADE', 'ACILIS', 'DUZELTME');

-- AlterEnum


ALTER TYPE "PdksGunDurum" ADD VALUE 'IZINLI';
ALTER TYPE "PdksGunDurum" ADD VALUE 'RAPORLU';

-- AlterTable
ALTER TABLE "pdks_puantaj_gun" ADD COLUMN     "izinEtiketi" TEXT,
ADD COLUMN     "izinPay" DECIMAL(2,1),
ADD COLUMN     "izinTalepId" TEXT;

-- CreateTable
CREATE TABLE "izin_turu" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "yasal" BOOLEAN NOT NULL DEFAULT false,
    "bakiyeli" BOOLEAN NOT NULL DEFAULT false,
    "sabitGun" INTEGER,
    "gunSayimi" "IzinGunSayimi" NOT NULL DEFAULT 'IS_GUNU',
    "ucretli" BOOLEAN NOT NULL DEFAULT true,
    "yarimGunOlur" BOOLEAN NOT NULL DEFAULT false,
    "onayAkisi" "IzinOnayAkisi" NOT NULL DEFAULT 'YONETICI_IV',
    "belgeZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "ozelNitelikli" BOOLEAN NOT NULL DEFAULT false,
    "pdksEtiketi" TEXT NOT NULL,
    "kosul" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "izin_turu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin_talep" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "turId" TEXT NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE NOT NULL,
    "baslangicYarim" "IzinYarim",
    "bitisYarim" "IzinYarim",
    "gunSayisi" DECIMAL(5,1) NOT NULL,
    "aciklama" TEXT,
    "durum" "IzinDurumu" NOT NULL,
    "talepEdenId" TEXT NOT NULL,
    "onayci1Id" TEXT,
    "onayci2Id" TEXT,
    "onayci3Id" TEXT,
    "iptalEdenId" TEXT,
    "iptalAt" TIMESTAMP(3),
    "iptalGerekcesi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "izin_talep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin_talep_gun" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "pay" DECIMAL(2,1) NOT NULL,
    "yarim" "IzinYarim",

    CONSTRAINT "izin_talep_gun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin_onay" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "kademe" TEXT NOT NULL,
    "onaylayanId" TEXT NOT NULL,
    "karar" TEXT NOT NULL,
    "gerekce" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_onay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin_bakiye_hareketi" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "turId" TEXT NOT NULL,
    "hareket" "IzinHareketTuru" NOT NULL,
    "gun" DECIMAL(5,1) NOT NULL,
    "tarih" DATE NOT NULL,
    "talepId" TEXT,
    "aciklama" TEXT,
    "olusturanId" TEXT NOT NULL,
    "anahtar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_bakiye_hareketi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin_belge" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "dosyaAdi" TEXT NOT NULL,
    "orijinalAd" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "boyut" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "yukleyenId" TEXT NOT NULL,
    "imhaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_belge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "izin_turu_kod_key" ON "izin_turu"("kod");

-- CreateIndex
CREATE INDEX "izin_talep_personnelId_baslangic_idx" ON "izin_talep"("personnelId", "baslangic");

-- CreateIndex
CREATE INDEX "izin_talep_durum_idx" ON "izin_talep"("durum");

-- CreateIndex
CREATE INDEX "izin_talep_onayci1Id_idx" ON "izin_talep"("onayci1Id");

-- CreateIndex
CREATE INDEX "izin_talep_onayci2Id_idx" ON "izin_talep"("onayci2Id");

-- CreateIndex
CREATE INDEX "izin_talep_onayci3Id_idx" ON "izin_talep"("onayci3Id");

-- CreateIndex
CREATE INDEX "izin_talep_gun_personnelId_tarih_idx" ON "izin_talep_gun"("personnelId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "izin_talep_gun_talepId_tarih_key" ON "izin_talep_gun"("talepId", "tarih");

-- CreateIndex
CREATE INDEX "izin_onay_talepId_idx" ON "izin_onay"("talepId");

-- CreateIndex
CREATE UNIQUE INDEX "izin_bakiye_hareketi_anahtar_key" ON "izin_bakiye_hareketi"("anahtar");

-- CreateIndex
CREATE INDEX "izin_bakiye_hareketi_personnelId_turId_tarih_idx" ON "izin_bakiye_hareketi"("personnelId", "turId", "tarih");

-- CreateIndex
CREATE INDEX "izin_bakiye_hareketi_talepId_idx" ON "izin_bakiye_hareketi"("talepId");

-- CreateIndex
CREATE INDEX "izin_belge_talepId_idx" ON "izin_belge"("talepId");

-- CreateIndex
CREATE INDEX "pdks_puantaj_gun_izinTalepId_idx" ON "pdks_puantaj_gun"("izinTalepId");

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_izinTalepId_fkey" FOREIGN KEY ("izinTalepId") REFERENCES "izin_talep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_talep" ADD CONSTRAINT "izin_talep_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_talep" ADD CONSTRAINT "izin_talep_turId_fkey" FOREIGN KEY ("turId") REFERENCES "izin_turu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_talep_gun" ADD CONSTRAINT "izin_talep_gun_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "izin_talep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_talep_gun" ADD CONSTRAINT "izin_talep_gun_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_onay" ADD CONSTRAINT "izin_onay_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "izin_talep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_bakiye_hareketi" ADD CONSTRAINT "izin_bakiye_hareketi_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_bakiye_hareketi" ADD CONSTRAINT "izin_bakiye_hareketi_turId_fkey" FOREIGN KEY ("turId") REFERENCES "izin_turu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_bakiye_hareketi" ADD CONSTRAINT "izin_bakiye_hareketi_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "izin_talep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_belge" ADD CONSTRAINT "izin_belge_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "izin_talep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===================== Bölüm 2: manuel SQL =====================

-- İzin bakiye DEFTERİ yalnız eklenir: bakiye = Σ gun. Düzeltme yeni DUZELTME satırıyla yapılır.
CREATE FUNCTION "izin_bakiye_hareketi_degismez"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'izin_bakiye_hareketi değiştirilemez (% reddedildi) — düzeltme yeni DUZELTME hareketiyle yapılır', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "izin_bakiye_hareketi_degismez_satir"
  BEFORE UPDATE OR DELETE ON "izin_bakiye_hareketi"
  FOR EACH ROW EXECUTE FUNCTION "izin_bakiye_hareketi_degismez"();

CREATE TRIGGER "izin_bakiye_hareketi_degismez_truncate"
  BEFORE TRUNCATE ON "izin_bakiye_hareketi"
  FOR EACH STATEMENT EXECUTE FUNCTION "izin_bakiye_hareketi_degismez"();

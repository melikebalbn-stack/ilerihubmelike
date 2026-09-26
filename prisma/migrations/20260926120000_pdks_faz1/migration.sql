-- PDKS Faz 1 — şema (Hikvision DS-K2604T). Plan: "PDKS Modülü — Tasarım Planı" §2.
-- ADDITIVE: 4 enum + 8 yeni tablo. DROP yok; mevcut tablolara (Personnel, ipro_vardiya,
-- BulkCardScanFailure) kolon EKLENMEZ — yalnız yeni tablolardan onlara FK.
-- Prod: psql -f + prisma migrate resolve --applied (migrate deploy YASAK).
-- Bölüm 2 (dosya sonu) Prisma'nın ifade edemediği nesneler: değişmezlik trigger'ı + kısmi unique'ler.
-- UYARI: sonraki `prisma migrate dev` çıktıları bu iki kısmi index için DROP INDEX
-- üretebilir (schema.prisma'da görünmezler) — öyle bir satır çıkarsa migration'dan SİLİNMELİ.

-- ===================== Bölüm 1: Prisma migrate diff çıktısı =====================
-- CreateEnum
CREATE TYPE "PdksYon" AS ENUM ('GIRIS', 'CIKIS');

-- CreateEnum
CREATE TYPE "PdksKartDurum" AS ENUM ('AKTIF', 'PASIF');

-- CreateEnum
CREATE TYPE "PdksGecisKaynak" AS ENUM ('PUSH', 'POLL', 'GV_IMPORT');

-- CreateEnum
CREATE TYPE "PdksGunDurum" AS ENUM ('TAM', 'EKSIK_GIRIS', 'EKSIK_CIKIS', 'GELMEDI', 'TATIL', 'HAFTA_SONU', 'BEKLENMIYOR');

-- CreateTable
CREATE TABLE "pdks_cihaz" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "marka" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "envOnek" TEXT NOT NULL,
    "seriNo" TEXT,
    "firmware" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "seriDonem" INTEGER NOT NULL DEFAULT 1,
    "sonSeriNo" INTEGER,
    "sonGorulmeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdks_cihaz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_kapi" (
    "id" TEXT NOT NULL,
    "cihazId" TEXT NOT NULL,
    "kapiNo" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "grup" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pdks_kapi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_okuyucu" (
    "id" TEXT NOT NULL,
    "kapiId" TEXT NOT NULL,
    "okuyucuNo" INTEGER NOT NULL,
    "yon" "PdksYon" NOT NULL,
    "puantajaDahil" BOOLEAN NOT NULL DEFAULT true,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pdks_okuyucu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_kart" (
    "id" TEXT NOT NULL,
    "kartNo" TEXT NOT NULL,
    "kartNoHam" TEXT,
    "personnelId" TEXT NOT NULL,
    "durum" "PdksKartDurum" NOT NULL DEFAULT 'AKTIF',
    "gecerliBaslangic" TIMESTAMP(3) NOT NULL,
    "gecerliBitis" TIMESTAMP(3),
    "pasifNedeni" TEXT,
    "pasifAt" TIMESTAMP(3),
    "pasifYapanId" TEXT,
    "kaynak" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdks_kart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_kart_cihaz" (
    "id" TEXT NOT NULL,
    "kartId" TEXT NOT NULL,
    "cihazId" TEXT NOT NULL,
    "durum" TEXT NOT NULL,
    "deneme" INTEGER NOT NULL DEFAULT 0,
    "sonHata" TEXT,
    "sonDenemeAt" TIMESTAMP(3),
    "yuklendiAt" TIMESTAMP(3),

    CONSTRAINT "pdks_kart_cihaz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_gecis" (
    "id" TEXT NOT NULL,
    "dedupAnahtar" TEXT NOT NULL,
    "cihazId" TEXT NOT NULL,
    "seriDonem" INTEGER,
    "seriNo" INTEGER,
    "olayZamani" TIMESTAMPTZ(3) NOT NULL,
    "cihazZamaniHam" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "olayTipi" TEXT NOT NULL,
    "gecerli" BOOLEAN NOT NULL,
    "kapiNo" INTEGER,
    "okuyucuNo" INTEGER,
    "okuyucuId" TEXT,
    "yon" "PdksYon",
    "kartNo" TEXT,
    "employeeNo" TEXT,
    "personnelId" TEXT,
    "kaynak" "PdksGecisKaynak" NOT NULL,
    "ham" JSONB NOT NULL,
    "alindiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdks_gecis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_puantaj_gun" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "gun" DATE NOT NULL,
    "vardiyaId" TEXT,
    "vardiyaKaynak" TEXT,
    "beklenenBaslangic" TIMESTAMPTZ(3),
    "beklenenBitis" TIMESTAMPTZ(3),
    "ilkGiris" TIMESTAMPTZ(3),
    "sonCikis" TIMESTAMPTZ(3),
    "ilkGirisGecisId" TEXT,
    "sonCikisGecisId" TEXT,
    "girisKaynak" TEXT,
    "cikisKaynak" TEXT,
    "kartOkutamamaId" TEXT,
    "durum" "PdksGunDurum" NOT NULL,
    "gecDakika" INTEGER NOT NULL DEFAULT 0,
    "erkenCikisDakika" INTEGER NOT NULL DEFAULT 0,
    "calismaDakika" INTEGER,
    "onayliMesaiDakika" INTEGER,
    "fazlaDakika" INTEGER,
    "uyarilar" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kilitli" BOOLEAN NOT NULL DEFAULT false,
    "kilitleyenId" TEXT,
    "hesaplamaSurumu" INTEGER NOT NULL,
    "hesaplandiAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdks_puantaj_gun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_personel_vardiya" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "vardiyaId" TEXT NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdks_personel_vardiya_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pdks_cihaz_kod_key" ON "pdks_cihaz"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "pdks_cihaz_envOnek_key" ON "pdks_cihaz"("envOnek");

-- CreateIndex
CREATE UNIQUE INDEX "pdks_kapi_cihazId_kapiNo_key" ON "pdks_kapi"("cihazId", "kapiNo");

-- CreateIndex
CREATE UNIQUE INDEX "pdks_okuyucu_kapiId_okuyucuNo_key" ON "pdks_okuyucu"("kapiId", "okuyucuNo");

-- CreateIndex
CREATE INDEX "pdks_kart_personnelId_idx" ON "pdks_kart"("personnelId");

-- CreateIndex
CREATE INDEX "pdks_kart_kartNo_idx" ON "pdks_kart"("kartNo");

-- CreateIndex
CREATE INDEX "pdks_kart_cihaz_durum_idx" ON "pdks_kart_cihaz"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "pdks_kart_cihaz_kartId_cihazId_key" ON "pdks_kart_cihaz"("kartId", "cihazId");

-- CreateIndex
CREATE UNIQUE INDEX "pdks_gecis_dedupAnahtar_key" ON "pdks_gecis"("dedupAnahtar");

-- CreateIndex
CREATE INDEX "pdks_gecis_personnelId_olayZamani_idx" ON "pdks_gecis"("personnelId", "olayZamani");

-- CreateIndex
CREATE INDEX "pdks_gecis_olayZamani_idx" ON "pdks_gecis"("olayZamani");

-- CreateIndex
CREATE INDEX "pdks_gecis_cihazId_seriDonem_seriNo_idx" ON "pdks_gecis"("cihazId", "seriDonem", "seriNo");

-- CreateIndex
CREATE INDEX "pdks_puantaj_gun_gun_durum_idx" ON "pdks_puantaj_gun"("gun", "durum");

-- CreateIndex
CREATE INDEX "pdks_puantaj_gun_vardiyaId_idx" ON "pdks_puantaj_gun"("vardiyaId");

-- CreateIndex
CREATE INDEX "pdks_puantaj_gun_kartOkutamamaId_idx" ON "pdks_puantaj_gun"("kartOkutamamaId");

-- CreateIndex
CREATE UNIQUE INDEX "pdks_puantaj_gun_personnelId_gun_key" ON "pdks_puantaj_gun"("personnelId", "gun");

-- CreateIndex
CREATE INDEX "pdks_personel_vardiya_personnelId_baslangic_idx" ON "pdks_personel_vardiya"("personnelId", "baslangic");

-- CreateIndex
CREATE INDEX "pdks_personel_vardiya_vardiyaId_idx" ON "pdks_personel_vardiya"("vardiyaId");

-- AddForeignKey
ALTER TABLE "pdks_kapi" ADD CONSTRAINT "pdks_kapi_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "pdks_cihaz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_okuyucu" ADD CONSTRAINT "pdks_okuyucu_kapiId_fkey" FOREIGN KEY ("kapiId") REFERENCES "pdks_kapi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_kart" ADD CONSTRAINT "pdks_kart_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_kart_cihaz" ADD CONSTRAINT "pdks_kart_cihaz_kartId_fkey" FOREIGN KEY ("kartId") REFERENCES "pdks_kart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_kart_cihaz" ADD CONSTRAINT "pdks_kart_cihaz_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "pdks_cihaz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_gecis" ADD CONSTRAINT "pdks_gecis_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "pdks_cihaz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_gecis" ADD CONSTRAINT "pdks_gecis_okuyucuId_fkey" FOREIGN KEY ("okuyucuId") REFERENCES "pdks_okuyucu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_gecis" ADD CONSTRAINT "pdks_gecis_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "ipro_vardiya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_ilkGirisGecisId_fkey" FOREIGN KEY ("ilkGirisGecisId") REFERENCES "pdks_gecis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_sonCikisGecisId_fkey" FOREIGN KEY ("sonCikisGecisId") REFERENCES "pdks_gecis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_kartOkutamamaId_fkey" FOREIGN KEY ("kartOkutamamaId") REFERENCES "BulkCardScanFailure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_personel_vardiya" ADD CONSTRAINT "pdks_personel_vardiya_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_personel_vardiya" ADD CONSTRAINT "pdks_personel_vardiya_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "ipro_vardiya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===================== Bölüm 2: manuel SQL =====================

-- pdks_gecis HAM OLAY tablosu değiştirilemez: UPDATE / DELETE / TRUNCATE reddedilir.
-- Düzeltme ayrı kayıtla (Kart Okutamama) yapılır. KVKK imha prosedürü ileride ayrı,
-- denetimli bir yolla eklenecek (Faz 5) — bu trigger'da şimdilik kaçış YOK.
CREATE FUNCTION "pdks_gecis_degismez"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pdks_gecis değiştirilemez (% reddedildi) — düzeltme Kart Okutamama formuyla yapılır', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "pdks_gecis_degismez_satir"
  BEFORE UPDATE OR DELETE ON "pdks_gecis"
  FOR EACH ROW EXECUTE FUNCTION "pdks_gecis_degismez"();

CREATE TRIGGER "pdks_gecis_degismez_truncate"
  BEFORE TRUNCATE ON "pdks_gecis"
  FOR EACH STATEMENT EXECUTE FUNCTION "pdks_gecis_degismez"();

-- Kişi başı tek AKTIF kart; bir kart numarası aynı anda tek kişide AKTIF.
-- PASIF satırlar serbest (geçmiş kartlar, yeniden verilen kart numarası).
CREATE UNIQUE INDEX "pdks_kart_aktif_kartNo_key"
  ON "pdks_kart"("kartNo") WHERE "durum" = 'AKTIF';

CREATE UNIQUE INDEX "pdks_kart_aktif_personnelId_key"
  ON "pdks_kart"("personnelId") WHERE "durum" = 'AKTIF';

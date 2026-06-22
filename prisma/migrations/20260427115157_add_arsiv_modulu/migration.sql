-- CreateEnum
CREATE TYPE "ArsivKoliDurum" AS ENUM ('Aktif', 'ImhaYaklasti', 'ImhaEdildi', 'Arsivde');

-- CreateEnum
CREATE TYPE "ArsivGizlilik" AS ENUM ('KamuyaAcik', 'SirketIci', 'Gizli', 'CokGizli');

-- CreateEnum
CREATE TYPE "ArsivImhaYontemi" AS ENUM ('Imhaci', 'EvrakImhaMakinesi', 'Yakma', 'GuvenliSilme', 'Diger');

-- CreateEnum
CREATE TYPE "ArsivIslemTuru" AS ENUM ('Olustur', 'Goruntule', 'Duzenle', 'Sil', 'EtiketBas', 'QrTara', 'AltKoliEkle', 'AltKoliCikar', 'ImhaTalep', 'ImhaOnayla', 'ImhaReddet', 'KoliAc', 'TopluIceAktar', 'RaporCikar');

-- CreateEnum
CREATE TYPE "ArsivKoliTipi" AS ENUM ('Ana', 'Alt');

-- CreateTable
CREATE TABLE "arsiv_departman" (
    "id" SERIAL NOT NULL,
    "kod" VARCHAR(3) NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "renk_hex" CHAR(7) NOT NULL DEFAULT '#888780',
    "aktif_mi" BOOLEAN NOT NULL DEFAULT true,
    "olusturma_tarihi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(3),

    CONSTRAINT "arsiv_departman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsiv_lokasyon" (
    "id" SERIAL NOT NULL,
    "depo_no" VARCHAR(20) NOT NULL,
    "raf_kodu" VARCHAR(20) NOT NULL,
    "sira_no" INTEGER NOT NULL,
    "kapasite" INTEGER NOT NULL DEFAULT 50,
    "mevcut_doluluk" INTEGER NOT NULL DEFAULT 0,
    "aciklama" VARCHAR(250),
    "aktif_mi" BOOLEAN NOT NULL DEFAULT true,
    "olusturma_tarihi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arsiv_lokasyon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsiv_evrak_turu" (
    "id" SERIAL NOT NULL,
    "departman_id" INTEGER NOT NULL,
    "ad" VARCHAR(150) NOT NULL,
    "varsayilan_saklama_yili" INTEGER NOT NULL DEFAULT 10,
    "yasal_dayanak" VARCHAR(250),
    "aktif_mi" BOOLEAN NOT NULL DEFAULT true,
    "olusturma_tarihi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arsiv_evrak_turu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsiv_sayac" (
    "departman_id" INTEGER NOT NULL,
    "yil" INTEGER NOT NULL,
    "son_sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "arsiv_sayac_pkey" PRIMARY KEY ("departman_id","yil")
);

-- CreateTable
CREATE TABLE "arsiv_koli" (
    "id" BIGSERIAL NOT NULL,
    "arsiv_no" VARCHAR(20) NOT NULL,
    "departman_id" INTEGER NOT NULL,
    "lokasyon_id" INTEGER,
    "tarih_araligi_baslangic" DATE NOT NULL,
    "tarih_araligi_sonu" DATE NOT NULL,
    "arsivleme_tarihi" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imha_tarihi" DATE NOT NULL,
    "durum" "ArsivKoliDurum" NOT NULL DEFAULT 'Aktif',
    "qr_kod" VARCHAR(500) NOT NULL,
    "aciklama" VARCHAR(500),
    "sorumlu_kullanici_id" TEXT NOT NULL,
    "olusturan_kullanici_id" TEXT NOT NULL,
    "guncelleyen_kullanici_id" TEXT,
    "olusturma_tarihi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(3),

    CONSTRAINT "arsiv_koli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsiv_alt_koli" (
    "id" BIGSERIAL NOT NULL,
    "alt_arsiv_no" VARCHAR(22) NOT NULL,
    "ana_koli_id" BIGINT NOT NULL,
    "harf" CHAR(1) NOT NULL,
    "evrak_turu_id" INTEGER NOT NULL,
    "donem_baslangic" DATE NOT NULL,
    "donem_sonu" DATE NOT NULL,
    "evrak_sayisi" INTEGER,
    "gizlilik_seviyesi" "ArsivGizlilik" NOT NULL DEFAULT 'SirketIci',
    "saklama_suresi_yil" INTEGER NOT NULL,
    "imha_tarihi" DATE NOT NULL,
    "hazirlayan" VARCHAR(150),
    "qr_kod" VARCHAR(500) NOT NULL,
    "aciklama" VARCHAR(500),
    "olusturan_kullanici_id" TEXT NOT NULL,
    "guncelleyen_kullanici_id" TEXT,
    "olusturma_tarihi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(3),

    CONSTRAINT "arsiv_alt_koli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsiv_imha_kaydi" (
    "id" BIGSERIAL NOT NULL,
    "ana_koli_id" BIGINT NOT NULL,
    "imha_tarihi" TIMESTAMPTZ(3) NOT NULL,
    "onaylayan_kullanici_id" TEXT NOT NULL,
    "ikincil_onaylayan_id" TEXT,
    "imha_yontemi" "ArsivImhaYontemi" NOT NULL,
    "imha_belgesi_url" VARCHAR(500),
    "notlar" VARCHAR(1000),
    "olusturma_tarihi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arsiv_imha_kaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsiv_aktivite_log" (
    "id" BIGSERIAL NOT NULL,
    "kullanici_id" TEXT NOT NULL,
    "islem_turu" "ArsivIslemTuru" NOT NULL,
    "koli_id" BIGINT,
    "koli_tipi" "ArsivKoliTipi",
    "tarih" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_adresi" VARCHAR(45),
    "kullanici_ajan" VARCHAR(500),
    "detay" JSONB,

    CONSTRAINT "arsiv_aktivite_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arsiv_departman_kod_key" ON "arsiv_departman"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "uq_arsiv_lokasyon_adres" ON "arsiv_lokasyon"("depo_no", "raf_kodu", "sira_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_arsiv_evrak_turu_dept_ad" ON "arsiv_evrak_turu"("departman_id", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "arsiv_koli_arsiv_no_key" ON "arsiv_koli"("arsiv_no");

-- CreateIndex
CREATE INDEX "ix_arsiv_koli_dept_durum" ON "arsiv_koli"("departman_id", "durum");

-- CreateIndex
CREATE INDEX "ix_arsiv_koli_imha_tarihi" ON "arsiv_koli"("imha_tarihi");

-- CreateIndex
CREATE INDEX "ix_arsiv_koli_lokasyon" ON "arsiv_koli"("lokasyon_id");

-- CreateIndex
CREATE UNIQUE INDEX "arsiv_alt_koli_alt_arsiv_no_key" ON "arsiv_alt_koli"("alt_arsiv_no");

-- CreateIndex
CREATE INDEX "ix_arsiv_alt_koli_ana" ON "arsiv_alt_koli"("ana_koli_id");

-- CreateIndex
CREATE INDEX "ix_arsiv_alt_koli_evrak_turu" ON "arsiv_alt_koli"("evrak_turu_id");

-- CreateIndex
CREATE INDEX "ix_arsiv_alt_koli_imha" ON "arsiv_alt_koli"("imha_tarihi");

-- CreateIndex
CREATE UNIQUE INDEX "uq_arsiv_alt_koli_ana_harf" ON "arsiv_alt_koli"("ana_koli_id", "harf");

-- CreateIndex
CREATE INDEX "ix_arsiv_imha_kaydi_ana" ON "arsiv_imha_kaydi"("ana_koli_id");

-- CreateIndex
CREATE INDEX "ix_arsiv_imha_kaydi_tarih" ON "arsiv_imha_kaydi"("imha_tarihi" DESC);

-- CreateIndex
CREATE INDEX "ix_arsiv_log_koli_tarih" ON "arsiv_aktivite_log"("koli_id", "tarih" DESC);

-- CreateIndex
CREATE INDEX "ix_arsiv_log_kullanici_tarih" ON "arsiv_aktivite_log"("kullanici_id", "tarih" DESC);

-- CreateIndex
CREATE INDEX "ix_arsiv_log_tarih" ON "arsiv_aktivite_log"("tarih" DESC);

-- AddForeignKey
ALTER TABLE "arsiv_evrak_turu" ADD CONSTRAINT "arsiv_evrak_turu_departman_id_fkey" FOREIGN KEY ("departman_id") REFERENCES "arsiv_departman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_sayac" ADD CONSTRAINT "arsiv_sayac_departman_id_fkey" FOREIGN KEY ("departman_id") REFERENCES "arsiv_departman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_koli" ADD CONSTRAINT "arsiv_koli_departman_id_fkey" FOREIGN KEY ("departman_id") REFERENCES "arsiv_departman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_koli" ADD CONSTRAINT "arsiv_koli_lokasyon_id_fkey" FOREIGN KEY ("lokasyon_id") REFERENCES "arsiv_lokasyon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_koli" ADD CONSTRAINT "arsiv_koli_sorumlu_kullanici_id_fkey" FOREIGN KEY ("sorumlu_kullanici_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_koli" ADD CONSTRAINT "arsiv_koli_olusturan_kullanici_id_fkey" FOREIGN KEY ("olusturan_kullanici_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_koli" ADD CONSTRAINT "arsiv_koli_guncelleyen_kullanici_id_fkey" FOREIGN KEY ("guncelleyen_kullanici_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_alt_koli" ADD CONSTRAINT "arsiv_alt_koli_ana_koli_id_fkey" FOREIGN KEY ("ana_koli_id") REFERENCES "arsiv_koli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_alt_koli" ADD CONSTRAINT "arsiv_alt_koli_evrak_turu_id_fkey" FOREIGN KEY ("evrak_turu_id") REFERENCES "arsiv_evrak_turu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_alt_koli" ADD CONSTRAINT "arsiv_alt_koli_olusturan_kullanici_id_fkey" FOREIGN KEY ("olusturan_kullanici_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_alt_koli" ADD CONSTRAINT "arsiv_alt_koli_guncelleyen_kullanici_id_fkey" FOREIGN KEY ("guncelleyen_kullanici_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_imha_kaydi" ADD CONSTRAINT "arsiv_imha_kaydi_ana_koli_id_fkey" FOREIGN KEY ("ana_koli_id") REFERENCES "arsiv_koli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_imha_kaydi" ADD CONSTRAINT "arsiv_imha_kaydi_onaylayan_kullanici_id_fkey" FOREIGN KEY ("onaylayan_kullanici_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_imha_kaydi" ADD CONSTRAINT "arsiv_imha_kaydi_ikincil_onaylayan_id_fkey" FOREIGN KEY ("ikincil_onaylayan_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsiv_aktivite_log" ADD CONSTRAINT "arsiv_aktivite_log_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ============================================================================
-- Arşiv Modülü — CHECK Constraints
-- ----------------------------------------------------------------------------
-- Bu blok, prisma migrate üretiminden sonra migration.sql'in SONUNA eklenir.
-- Tüm tablo isimleri arsiv_ prefix'li (single-schema fallback) varsayımıyla.
-- ============================================================================

-- arsiv_departman
ALTER TABLE arsiv_departman
  ADD CONSTRAINT ck_arsiv_departman_kod_format
  CHECK (kod ~ '^[A-Z]{3}$');

ALTER TABLE arsiv_departman
  ADD CONSTRAINT ck_arsiv_departman_renk_format
  CHECK (renk_hex ~ '^#[0-9A-Fa-f]{6}$');

-- arsiv_lokasyon
ALTER TABLE arsiv_lokasyon
  ADD CONSTRAINT ck_arsiv_lokasyon_kapasite
  CHECK (kapasite > 0);

ALTER TABLE arsiv_lokasyon
  ADD CONSTRAINT ck_arsiv_lokasyon_doluluk
  CHECK (mevcut_doluluk >= 0 AND mevcut_doluluk <= kapasite);

-- arsiv_evrak_turu
ALTER TABLE arsiv_evrak_turu
  ADD CONSTRAINT ck_arsiv_evrak_turu_saklama
  CHECK (varsayilan_saklama_yili BETWEEN 1 AND 100);

-- arsiv_sayac
ALTER TABLE arsiv_sayac
  ADD CONSTRAINT ck_arsiv_sayac_yil
  CHECK (yil BETWEEN 2000 AND 2100);

ALTER TABLE arsiv_sayac
  ADD CONSTRAINT ck_arsiv_sayac_son_sira
  CHECK (son_sira >= 0);

-- arsiv_koli
ALTER TABLE arsiv_koli
  ADD CONSTRAINT ck_arsiv_koli_no_format
  CHECK (arsiv_no ~ '^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}$');

ALTER TABLE arsiv_koli
  ADD CONSTRAINT ck_arsiv_koli_tarih_araligi
  CHECK (tarih_araligi_baslangic <= tarih_araligi_sonu);

ALTER TABLE arsiv_koli
  ADD CONSTRAINT ck_arsiv_koli_imha_tarihi
  CHECK (imha_tarihi > arsivleme_tarihi);

-- arsiv_alt_koli
ALTER TABLE arsiv_alt_koli
  ADD CONSTRAINT ck_arsiv_alt_koli_no_format
  CHECK (alt_arsiv_no ~ '^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}-[A-Z]$');

ALTER TABLE arsiv_alt_koli
  ADD CONSTRAINT ck_arsiv_alt_koli_harf
  CHECK (harf ~ '^[A-Z]$');

ALTER TABLE arsiv_alt_koli
  ADD CONSTRAINT ck_arsiv_alt_koli_donem
  CHECK (donem_baslangic <= donem_sonu);

ALTER TABLE arsiv_alt_koli
  ADD CONSTRAINT ck_arsiv_alt_koli_saklama
  CHECK (saklama_suresi_yil BETWEEN 1 AND 100);

ALTER TABLE arsiv_alt_koli
  ADD CONSTRAINT ck_arsiv_alt_koli_evrak_sayisi
  CHECK (evrak_sayisi IS NULL OR evrak_sayisi >= 0);

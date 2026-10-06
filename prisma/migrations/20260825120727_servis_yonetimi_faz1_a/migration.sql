-- ============================================================================
-- SERVİS YÖNETİMİ — FAZ 1 / A KAPSAMI — Elle yazılmış migration
-- ============================================================================
--
-- BU SQL PRISMA TARAFINDAN ÜRETİLMEDİ, elle yazıldı. Uygulama adımları:
--
--   1) prisma/schema.prisma içine docs/servis-yonetimi/faz1-a-kapsami-
--      prisma-modeli.prisma dosyasındaki model/enum bloklarını (+ dosya
--      sonundaki ters ilişkileri Personnel/User'a) ekle.
--   2) Yeni bir migration klasörü oluştur:
--        prisma/migrations/<YYYYMMDDHHMMSS>_servis_yonetimi_faz1_a/migration.sql
--      ve bu dosyanın TAM İÇERİĞİNİ oraya kopyala.
--   3) `npx prisma migrate resolve --applied <migration_adi>` YERİNE normal
--      akış: staging'de `npx prisma migrate dev` ile şema+migration
--      senkronize edildiğini doğrula (bu dosya elle yazıldığından, Prisma'nın
--      "migrate dev" ile üreteceği SQL'in bu dosyayla birebir örtüştüğünü
--      kontrol et — CHECK/EXCLUDE/bileşik FK bölümleri Prisma çıktısında
--      OLMAYACAK, onları migration dosyasına bu dosyadan elle ekle).
--   4) Bu migration TAMAMEN YENİ tablolar/enum'lar oluşturuyor — mevcut hiçbir
--      tabloyu ALTER etmiyor. Bu yüzden docs/MIGRATION-RULES.md'deki
--      expand/migrate/contract kademelemesi GEREKMİYOR (Senaryo: "yeni tablo",
--      tek aşama, düşük risk — geriye dönük uyumluluğu bozacak hiçbir
--      mevcut sütun/tablo değişikliği yok).
--   5) Migration ÖNCE (prod DB'ye), deploy SONRA — MIGRATION-RULES.md sırası.
--
-- ============================================================================

-- Tarih aralığı EXCLUDE kısıtları için gerekli (gist index + range türleri).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- ENUM'LAR
-- ============================================================================

CREATE TYPE "ServisSeferDilimiYon" AS ENUM ('GIDIS', 'DONUS');

CREATE TYPE "ServisRol" AS ENUM ('ANA', 'YEDEK');

CREATE TYPE "ServisAtamaKaynagi" AS ENUM ('MANUEL', 'IMPORT');

-- Personelin servisi kullanıp kullanmadığı durumu (ALINMIŞ KARAR).
CREATE TYPE "ServisKullanimDurumu" AS ENUM ('SERVIS_KULLANIYOR', 'KENDI_GELIYOR', 'KULLANMIYOR');

CREATE TYPE "ServisIslemHedefTipi" AS ENUM (
  'FIRMA', 'YERLESKE', 'SEFER_DILIMI', 'GUZERGAH', 'DURAK', 'GUZERGAH_DURAK',
  'GUZERGAH_DURAK_SAAT', 'ARAC', 'SOFOR', 'GUZERGAH_ARAC_VARSAYILAN',
  'GUZERGAH_SOFOR_VARSAYILAN', 'PERSONEL_ATAMA', 'PERSONEL_ATAMA_DILIM',
  'SORUMLUSU', 'PERSONEL_DURUM'
);

CREATE TYPE "ServisIslemTuru" AS ENUM ('OLUSTURMA', 'GUNCELLEME', 'PASIFLESTIRME', 'AKTIFLESTIRME');

-- ============================================================================
-- TABLOLAR
-- ============================================================================

CREATE TABLE "servis_firma" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "yetkiliAdi" TEXT,
    "telefon" TEXT,
    "eposta" TEXT,
    "adres" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_firma_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_yerleske" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "adres" TEXT,
    "enlem" DECIMAL(9,6),
    "boylam" DECIMAL(9,6),
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_yerleske_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_sefer_dilimi" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "yon" "ServisSeferDilimiYon" NOT NULL,
    "grupKodu" TEXT,
    "sira" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_sefer_dilimi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_guzergah" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "bolge" TEXT,
    "yerleskeId" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "gecerlilikBaslangici" DATE,
    "gecerlilikBitisi" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_guzergah_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_durak" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "adresEtiketi" TEXT,
    "il" TEXT,
    "ilce" TEXT,
    "mahalle" TEXT,
    "enlem" DECIMAL(9,6),
    "boylam" DECIMAL(9,6),
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_durak_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_guzergah_durak" (
    "id" TEXT NOT NULL,
    "guzergahId" TEXT NOT NULL,
    "durakId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_guzergah_durak_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_guzergah_durak_saat" (
    "id" TEXT NOT NULL,
    "guzergahDurakId" TEXT NOT NULL,
    "dilimId" TEXT NOT NULL,
    "saat" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_guzergah_durak_saat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_arac" (
    "id" TEXT NOT NULL,
    "plaka" TEXT NOT NULL,
    "kapasite" INTEGER NOT NULL,
    "firmaId" TEXT NOT NULL,
    "aracTipi" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "gecerlilikBaslangici" DATE,
    "gecerlilikBitisi" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_arac_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_sofor" (
    "id" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT,
    "personnelId" TEXT,
    "firmaId" TEXT,
    "disFirmaSoforKodu" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_sofor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_guzergah_arac_varsayilan" (
    "id" TEXT NOT NULL,
    "guzergahId" TEXT NOT NULL,
    "dilimId" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "rol" "ServisRol" NOT NULL DEFAULT 'ANA',
    "baslangicTarihi" DATE NOT NULL,
    "bitisTarihi" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "neden" TEXT,
    "aciklama" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_guzergah_arac_varsayilan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_guzergah_sofor_varsayilan" (
    "id" TEXT NOT NULL,
    "guzergahId" TEXT NOT NULL,
    "dilimId" TEXT NOT NULL,
    "soforId" TEXT NOT NULL,
    "rol" "ServisRol" NOT NULL DEFAULT 'ANA',
    "baslangicTarihi" DATE NOT NULL,
    "bitisTarihi" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "neden" TEXT,
    "aciklama" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_guzergah_sofor_varsayilan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_personel_atama" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "guzergahId" TEXT NOT NULL,
    "durakId" TEXT,
    "baslangicTarihi" DATE NOT NULL,
    "bitisTarihi" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "atamaKaynagi" "ServisAtamaKaynagi" NOT NULL DEFAULT 'MANUEL',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_personel_atama_pkey" PRIMARY KEY ("id")
);

-- Bir atamanın hangi dilim(ler)de geçerli olduğu (N:N). Tarihçe/aktif
-- taşımaz — geçerliliği ebeveyn servis_personel_atama'dan alır.
CREATE TABLE "servis_personel_atama_dilim" (
    "id" TEXT NOT NULL,
    "atamaId" TEXT NOT NULL,
    "dilimId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "servis_personel_atama_dilim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_sorumlusu" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "guzergahId" TEXT NOT NULL,
    "rol" "ServisRol" NOT NULL DEFAULT 'ANA',
    "baslangicTarihi" DATE NOT NULL,
    "bitisTarihi" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "neden" TEXT,
    "aciklama" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_sorumlusu_pkey" PRIMARY KEY ("id")
);

-- Servis kullanım durumu (ALINMIŞ KARAR) — bkz. Prisma dosyasındaki gerekçe.
CREATE TABLE "servis_personel_durum" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "durum" "ServisKullanimDurumu" NOT NULL,
    "baslangicTarihi" DATE NOT NULL,
    "bitisTarihi" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "neden" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "servis_personel_durum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servis_islem_gecmisi" (
    "id" TEXT NOT NULL,
    "hedefTipi" "ServisIslemHedefTipi" NOT NULL,
    "hedefId" TEXT NOT NULL,
    "islem" "ServisIslemTuru" NOT NULL,
    "oncekiDeger" JSONB,
    "yeniDeger" JSONB,
    "userId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    CONSTRAINT "servis_islem_gecmisi_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- INDEX'LER
-- ============================================================================

CREATE INDEX "servis_firma_aktif_idx" ON "servis_firma"("aktif");
CREATE INDEX "servis_firma_ad_idx" ON "servis_firma"("ad");

CREATE UNIQUE INDEX "servis_yerleske_kod_key" ON "servis_yerleske"("kod");
CREATE INDEX "servis_yerleske_aktif_idx" ON "servis_yerleske"("aktif");

CREATE UNIQUE INDEX "servis_sefer_dilimi_kod_key" ON "servis_sefer_dilimi"("kod");
CREATE INDEX "servis_sefer_dilimi_aktif_idx" ON "servis_sefer_dilimi"("aktif");
CREATE INDEX "servis_sefer_dilimi_yon_idx" ON "servis_sefer_dilimi"("yon");
CREATE INDEX "servis_sefer_dilimi_grupKodu_idx" ON "servis_sefer_dilimi"("grupKodu");

CREATE UNIQUE INDEX "servis_guzergah_kod_key" ON "servis_guzergah"("kod");
CREATE INDEX "servis_guzergah_aktif_idx" ON "servis_guzergah"("aktif");
CREATE INDEX "servis_guzergah_yerleskeId_idx" ON "servis_guzergah"("yerleskeId");
CREATE INDEX "servis_guzergah_gecerlilikBaslangici_gecerlilikBitisi_idx" ON "servis_guzergah"("gecerlilikBaslangici", "gecerlilikBitisi");

CREATE UNIQUE INDEX "servis_durak_kod_key" ON "servis_durak"("kod");
CREATE INDEX "servis_durak_aktif_idx" ON "servis_durak"("aktif");
CREATE INDEX "servis_durak_il_ilce_idx" ON "servis_durak"("il", "ilce");

CREATE INDEX "servis_guzergah_durak_durakId_idx" ON "servis_guzergah_durak"("durakId");
CREATE INDEX "servis_guzergah_durak_aktif_idx" ON "servis_guzergah_durak"("aktif");
CREATE UNIQUE INDEX "servis_guzergah_durak_guzergahId_sira_key" ON "servis_guzergah_durak"("guzergahId", "sira");
CREATE UNIQUE INDEX "servis_guzergah_durak_guzergahId_durakId_key" ON "servis_guzergah_durak"("guzergahId", "durakId");

CREATE UNIQUE INDEX "servis_guzergah_durak_saat_guzergahDurakId_dilimId_key" ON "servis_guzergah_durak_saat"("guzergahDurakId", "dilimId");
CREATE INDEX "servis_guzergah_durak_saat_dilimId_idx" ON "servis_guzergah_durak_saat"("dilimId");

CREATE UNIQUE INDEX "servis_arac_plaka_key" ON "servis_arac"("plaka");
CREATE INDEX "servis_arac_firmaId_idx" ON "servis_arac"("firmaId");
CREATE INDEX "servis_arac_aktif_idx" ON "servis_arac"("aktif");
CREATE INDEX "servis_arac_gecerlilikBaslangici_gecerlilikBitisi_idx" ON "servis_arac"("gecerlilikBaslangici", "gecerlilikBitisi");

CREATE UNIQUE INDEX "servis_sofor_personnelId_key" ON "servis_sofor"("personnelId");
CREATE INDEX "servis_sofor_firmaId_idx" ON "servis_sofor"("firmaId");
CREATE INDEX "servis_sofor_aktif_idx" ON "servis_sofor"("aktif");

CREATE INDEX "servis_guzergah_arac_varsayilan_guzergahId_dilimId_aktif_idx" ON "servis_guzergah_arac_varsayilan"("guzergahId", "dilimId", "aktif");
CREATE INDEX "servis_guzergah_arac_varsayilan_aracId_aktif_idx" ON "servis_guzergah_arac_varsayilan"("aracId", "aktif");
CREATE INDEX "servis_guzergah_arac_varsayilan_rol_idx" ON "servis_guzergah_arac_varsayilan"("rol");
CREATE INDEX "servis_guzergah_arac_varsayilan_baslangicTarihi_bitisTarihi_idx" ON "servis_guzergah_arac_varsayilan"("baslangicTarihi", "bitisTarihi");
CREATE INDEX "servis_guzergah_arac_varsayilan_createdById_idx" ON "servis_guzergah_arac_varsayilan"("createdById");
CREATE INDEX "servis_guzergah_arac_varsayilan_updatedById_idx" ON "servis_guzergah_arac_varsayilan"("updatedById");

CREATE INDEX "servis_guzergah_sofor_varsayilan_guzergahId_dilimId_aktif_idx" ON "servis_guzergah_sofor_varsayilan"("guzergahId", "dilimId", "aktif");
CREATE INDEX "servis_guzergah_sofor_varsayilan_soforId_aktif_idx" ON "servis_guzergah_sofor_varsayilan"("soforId", "aktif");
CREATE INDEX "servis_guzergah_sofor_varsayilan_rol_idx" ON "servis_guzergah_sofor_varsayilan"("rol");
CREATE INDEX "servis_guzergah_sofor_varsayilan_baslangicTarihi_bitisTarih_idx" ON "servis_guzergah_sofor_varsayilan"("baslangicTarihi", "bitisTarihi");
CREATE INDEX "servis_guzergah_sofor_varsayilan_createdById_idx" ON "servis_guzergah_sofor_varsayilan"("createdById");
CREATE INDEX "servis_guzergah_sofor_varsayilan_updatedById_idx" ON "servis_guzergah_sofor_varsayilan"("updatedById");

CREATE INDEX "servis_personel_atama_personnelId_aktif_idx" ON "servis_personel_atama"("personnelId", "aktif");
CREATE INDEX "servis_personel_atama_guzergahId_aktif_idx" ON "servis_personel_atama"("guzergahId", "aktif");
CREATE INDEX "servis_personel_atama_durakId_idx" ON "servis_personel_atama"("durakId");
CREATE INDEX "servis_personel_atama_baslangicTarihi_bitisTarihi_idx" ON "servis_personel_atama"("baslangicTarihi", "bitisTarihi");
CREATE INDEX "servis_personel_atama_createdById_idx" ON "servis_personel_atama"("createdById");
CREATE INDEX "servis_personel_atama_updatedById_idx" ON "servis_personel_atama"("updatedById");

CREATE UNIQUE INDEX "servis_personel_atama_dilim_atamaId_dilimId_key" ON "servis_personel_atama_dilim"("atamaId", "dilimId");
CREATE INDEX "servis_personel_atama_dilim_dilimId_idx" ON "servis_personel_atama_dilim"("dilimId");

CREATE INDEX "servis_sorumlusu_guzergahId_rol_aktif_idx" ON "servis_sorumlusu"("guzergahId", "rol", "aktif");
CREATE INDEX "servis_sorumlusu_personnelId_aktif_idx" ON "servis_sorumlusu"("personnelId", "aktif");
CREATE INDEX "servis_sorumlusu_baslangicTarihi_bitisTarihi_idx" ON "servis_sorumlusu"("baslangicTarihi", "bitisTarihi");

CREATE INDEX "servis_personel_durum_personnelId_aktif_idx" ON "servis_personel_durum"("personnelId", "aktif");
CREATE INDEX "servis_personel_durum_durum_idx" ON "servis_personel_durum"("durum");
CREATE INDEX "servis_personel_durum_baslangicTarihi_bitisTarihi_idx" ON "servis_personel_durum"("baslangicTarihi", "bitisTarihi");

CREATE INDEX "servis_islem_gecmisi_hedefTipi_hedefId_tarih_idx" ON "servis_islem_gecmisi"("hedefTipi", "hedefId", "tarih");
CREATE INDEX "servis_islem_gecmisi_userId_tarih_idx" ON "servis_islem_gecmisi"("userId", "tarih");

-- ============================================================================
-- YABANCI ANAHTARLAR (tekil kolon — Prisma ilişkilerinden birebir)
-- ============================================================================

ALTER TABLE "servis_guzergah" ADD CONSTRAINT "servis_guzergah_yerleskeId_fkey" FOREIGN KEY ("yerleskeId") REFERENCES "servis_yerleske"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_guzergah_durak" ADD CONSTRAINT "servis_guzergah_durak_guzergahId_fkey" FOREIGN KEY ("guzergahId") REFERENCES "servis_guzergah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_durak" ADD CONSTRAINT "servis_guzergah_durak_durakId_fkey" FOREIGN KEY ("durakId") REFERENCES "servis_durak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_guzergah_durak_saat" ADD CONSTRAINT "servis_guzergah_durak_saat_guzergahDurakId_fkey" FOREIGN KEY ("guzergahDurakId") REFERENCES "servis_guzergah_durak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_durak_saat" ADD CONSTRAINT "servis_guzergah_durak_saat_dilimId_fkey" FOREIGN KEY ("dilimId") REFERENCES "servis_sefer_dilimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_arac" ADD CONSTRAINT "servis_arac_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "servis_firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_sofor" ADD CONSTRAINT "servis_sofor_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_sofor" ADD CONSTRAINT "servis_sofor_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "servis_firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_guzergah_arac_varsayilan" ADD CONSTRAINT "servis_guzergah_arac_varsayilan_guzergahId_fkey" FOREIGN KEY ("guzergahId") REFERENCES "servis_guzergah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_arac_varsayilan" ADD CONSTRAINT "servis_guzergah_arac_varsayilan_dilimId_fkey" FOREIGN KEY ("dilimId") REFERENCES "servis_sefer_dilimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_arac_varsayilan" ADD CONSTRAINT "servis_guzergah_arac_varsayilan_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "servis_arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_arac_varsayilan" ADD CONSTRAINT "servis_guzergah_arac_varsayilan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_arac_varsayilan" ADD CONSTRAINT "servis_guzergah_arac_varsayilan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_guzergah_sofor_varsayilan" ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_guzergahId_fkey" FOREIGN KEY ("guzergahId") REFERENCES "servis_guzergah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_sofor_varsayilan" ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_dilimId_fkey" FOREIGN KEY ("dilimId") REFERENCES "servis_sefer_dilimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_sofor_varsayilan" ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "servis_sofor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_sofor_varsayilan" ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_guzergah_sofor_varsayilan" ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_personel_atama" ADD CONSTRAINT "servis_personel_atama_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_personel_atama" ADD CONSTRAINT "servis_personel_atama_guzergahId_fkey" FOREIGN KEY ("guzergahId") REFERENCES "servis_guzergah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_personel_atama" ADD CONSTRAINT "servis_personel_atama_durakId_fkey" FOREIGN KEY ("durakId") REFERENCES "servis_durak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_personel_atama" ADD CONSTRAINT "servis_personel_atama_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "servis_personel_atama" ADD CONSTRAINT "servis_personel_atama_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "servis_personel_atama_dilim" ADD CONSTRAINT "servis_personel_atama_dilim_atamaId_fkey" FOREIGN KEY ("atamaId") REFERENCES "servis_personel_atama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_personel_atama_dilim" ADD CONSTRAINT "servis_personel_atama_dilim_dilimId_fkey" FOREIGN KEY ("dilimId") REFERENCES "servis_sefer_dilimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servis_sorumlusu" ADD CONSTRAINT "servis_sorumlusu_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_sorumlusu" ADD CONSTRAINT "servis_sorumlusu_guzergahId_fkey" FOREIGN KEY ("guzergahId") REFERENCES "servis_guzergah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_sorumlusu" ADD CONSTRAINT "servis_sorumlusu_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_sorumlusu" ADD CONSTRAINT "servis_sorumlusu_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- servis_personel_durum FK'leri
ALTER TABLE "servis_personel_durum" ADD CONSTRAINT "servis_personel_durum_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servis_personel_durum" ADD CONSTRAINT "servis_personel_durum_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "servis_personel_durum" ADD CONSTRAINT "servis_personel_durum_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "servis_islem_gecmisi" ADD CONSTRAINT "servis_islem_gecmisi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- BİLEŞİK YABANCI ANAHTAR — Prisma ifade edemez
-- ============================================================================
-- ServisPersonelAtama.durakId'nin, ServisPersonelAtama.guzergahId'ye ait
-- GERÇEKTEN o güzergahın bir durağı olduğunu DB seviyesinde garanti eder.
-- Bu olmadan, servis katmanı kodu doğru kontrol etmezse, bir personel yanlış
-- güzergahın durağına atanabilir (Faz 0.5 keşfindeki tespit edilmiş risk).
-- Referans verilen (guzergahId, durakId) unique çifti servis_guzergah_durak
-- tablosunda zaten mevcut (bkz. yukarıdaki UNIQUE INDEX).
--
-- durakId NULLABLE (göç envanterinde 43 kayıt: güzergah var, durak yok).
-- PostgreSQL'de çok-kolonlu FK'nin varsayılan eşleşme kuralı MATCH SIMPLE'dır
-- (MATCH FULL/PARTIAL AÇIKÇA belirtilmediği sürece budur) — bileşik anahtarın
-- HERHANGİ BİR sütunu NULL olduğunda kısıt o satır için hiç DEĞERLENDİRİLMEZ.
-- Yani durakId NULL iken guzergahId dolu olsa da bu FK satırı SESSİZCE GEÇER;
-- durakId dolduğunda ise (guzergahId, durakId) çiftinin gerçekten
-- servis_guzergah_durak'ta var olması yine ZORUNLU kalır. Aşağıdaki FK
-- tanımı bu davranış için ekstra bir şey GEREKTİRMEZ — MATCH SIMPLE zaten
-- Postgres'in varsayılanı.
ALTER TABLE "servis_personel_atama"
  ADD CONSTRAINT "servis_personel_atama_guzergah_durak_fkey"
  FOREIGN KEY ("guzergahId", "durakId")
  REFERENCES "servis_guzergah_durak"("guzergahId", "durakId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- CHECK KISITLARI
-- ============================================================================

-- Araç kapasitesi anlamsız (0 veya negatif) olamaz.
ALTER TABLE "servis_arac"
  ADD CONSTRAINT "servis_arac_kapasite_check" CHECK ("kapasite" > 0);

-- Geçerlilik bitişi başlangıçtan önce olamaz (her iki uç da NULL olabilir —
-- açık uçlu aralık).
ALTER TABLE "servis_arac"
  ADD CONSTRAINT "servis_arac_gecerlilik_tarihleri_check" CHECK (
    "gecerlilikBitisi" IS NULL OR "gecerlilikBaslangici" IS NULL OR "gecerlilikBitisi" >= "gecerlilikBaslangici"
  );

ALTER TABLE "servis_guzergah"
  ADD CONSTRAINT "servis_guzergah_gecerlilik_tarihleri_check" CHECK (
    "gecerlilikBitisi" IS NULL OR "gecerlilikBaslangici" IS NULL OR "gecerlilikBitisi" >= "gecerlilikBaslangici"
  );

-- Durak sırası pozitif olmalı (0. veya negatif sıra anlamsız).
ALTER TABLE "servis_guzergah_durak"
  ADD CONSTRAINT "servis_guzergah_durak_sira_check" CHECK ("sira" > 0);

-- Dilim sırası pozitif olmalı.
ALTER TABLE "servis_sefer_dilimi"
  ADD CONSTRAINT "servis_sefer_dilimi_sira_check" CHECK ("sira" > 0);

-- Saat alanı HH:mm formatına uymalı (00:00–23:59). Zod bunu API katmanında
-- da doğrular; bu CHECK son savunma hattıdır (elle DB yazımı / script hatası).
ALTER TABLE "servis_guzergah_durak_saat"
  ADD CONSTRAINT "servis_guzergah_durak_saat_saat_check" CHECK (
    "saat" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

-- Koordinatlar makul coğrafi aralıkta olmalı (enlem: kutuptan kutuba,
-- boylam: tarih değişim çizgisinden çizgiye). Yanlış girilen bir GPS
-- koordinatının haritada sessizce yanlış yerde görünmesini engeller.
ALTER TABLE "servis_yerleske"
  ADD CONSTRAINT "servis_yerleske_enlem_check" CHECK ("enlem" IS NULL OR ("enlem" >= -90 AND "enlem" <= 90)),
  ADD CONSTRAINT "servis_yerleske_boylam_check" CHECK ("boylam" IS NULL OR ("boylam" >= -180 AND "boylam" <= 180));

ALTER TABLE "servis_durak"
  ADD CONSTRAINT "servis_durak_enlem_check" CHECK ("enlem" IS NULL OR ("enlem" >= -90 AND "enlem" <= 90)),
  ADD CONSTRAINT "servis_durak_boylam_check" CHECK ("boylam" IS NULL OR ("boylam" >= -180 AND "boylam" <= 180));

-- Varsayılan araç/şoför/personel/sorumlu/durum atamalarında bitiş
-- başlangıçtan önce olamaz (tüm tarih çiftleri için tekrarlanan kural).
ALTER TABLE "servis_guzergah_arac_varsayilan"
  ADD CONSTRAINT "servis_guzergah_arac_varsayilan_tarihleri_check" CHECK (
    "bitisTarihi" IS NULL OR "bitisTarihi" >= "baslangicTarihi"
  );

ALTER TABLE "servis_guzergah_sofor_varsayilan"
  ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_tarihleri_check" CHECK (
    "bitisTarihi" IS NULL OR "bitisTarihi" >= "baslangicTarihi"
  );

ALTER TABLE "servis_personel_atama"
  ADD CONSTRAINT "servis_personel_atama_tarihleri_check" CHECK (
    "bitisTarihi" IS NULL OR "bitisTarihi" >= "baslangicTarihi"
  );

ALTER TABLE "servis_sorumlusu"
  ADD CONSTRAINT "servis_sorumlusu_tarihleri_check" CHECK (
    "bitisTarihi" IS NULL OR "bitisTarihi" >= "baslangicTarihi"
  );

ALTER TABLE "servis_personel_durum"
  ADD CONSTRAINT "servis_personel_durum_tarihleri_check" CHECK (
    "bitisTarihi" IS NULL OR "bitisTarihi" >= "baslangicTarihi"
  );

-- Sürücü kimliği eksik kalamaz: ya dahili personel (personnelId), ya da dış
-- firma sürücüsü + ayırt edici kod (TC İSTENMİYOR — KVKK). Her ikisi de NULL
-- olan bir "kimliksiz" şoför kaydı DB seviyesinde engellenir.
ALTER TABLE "servis_sofor"
  ADD CONSTRAINT "servis_sofor_kimlik_check" CHECK (
    "personnelId" IS NOT NULL
    OR ("firmaId" IS NOT NULL AND "disFirmaSoforKodu" IS NOT NULL)
  );

-- ============================================================================
-- EXCLUSION CONSTRAINT'LER — yalnız burada, Prisma şemasına GİRMEZ
-- ============================================================================
-- Tarih aralığı iki ucu dahil ('[]') — bir kaydın hem başlangıç hem bitiş
-- günü de çakışma sayılır. COALESCE(bitis, 'infinity') açık uçlu (hâlâ
-- devam eden) atamaları da doğru şekilde kapsar.

-- Aynı fiziksel araç, aynı dilimde, çakışan tarih aralıklarında birden fazla
-- güzergahın ANA aracı olamaz (aynı anda iki hattı fiziken taşıyamaz).
-- guzergahId kısıta DAHİL DEĞİL — kısıt aracı bazlı: aynı güzergah+dilimde
-- birden çok ANA araç olması (yoğun hat, 2 araç) bu kısıtı İHLAL ETMEZ,
-- çünkü aracId farklıdır.
ALTER TABLE "servis_guzergah_arac_varsayilan"
  ADD CONSTRAINT "servis_guzergah_arac_varsayilan_aktif_tarih_excl"
  EXCLUDE USING gist (
    "aracId" WITH =,
    "dilimId" WITH =,
    daterange("baslangicTarihi", COALESCE("bitisTarihi", 'infinity'::date), '[]') WITH &&
  ) WHERE ("aktif" = true AND "rol" = 'ANA');

-- Aynı mantık, şoför için: aynı şoför aynı dilimde çakışan tarihlerde iki
-- farklı güzergahın ANA şoförü olamaz.
ALTER TABLE "servis_guzergah_sofor_varsayilan"
  ADD CONSTRAINT "servis_guzergah_sofor_varsayilan_aktif_tarih_excl"
  EXCLUDE USING gist (
    "soforId" WITH =,
    "dilimId" WITH =,
    daterange("baslangicTarihi", COALESCE("bitisTarihi", 'infinity'::date), '[]') WITH &&
  ) WHERE ("aktif" = true AND "rol" = 'ANA');

-- Bir personelin çakışan tarih aralıklarında aktif iki servis ataması olamaz
-- (aynı anda iki farklı güzergah+durağa "atanmış" görünemez).
ALTER TABLE "servis_personel_atama"
  ADD CONSTRAINT "servis_personel_atama_aktif_tarih_excl"
  EXCLUDE USING gist (
    "personnelId" WITH =,
    daterange("baslangicTarihi", COALESCE("bitisTarihi", 'infinity'::date), '[]') WITH &&
  ) WHERE ("aktif" = true);

-- Bir personelin çakışan tarihlerde aktif iki farklı kullanım durumu
-- (örn. hem "KULLANIYOR" hem "KENDİ_GELİYOR") olamaz.
ALTER TABLE "servis_personel_durum"
  ADD CONSTRAINT "servis_personel_durum_aktif_tarih_excl"
  EXCLUDE USING gist (
    "personnelId" WITH =,
    daterange("baslangicTarihi", COALESCE("bitisTarihi", 'infinity'::date), '[]') WITH &&
  ) WHERE ("aktif" = true);

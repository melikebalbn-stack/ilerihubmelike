-- ============================================================================
-- PR-ArsivBolumRefactor: arsiv_departman → arsiv_bolum
--
-- Tek atomik transaction. Herhangi bir adım fail = tümü rollback.
-- Schema doğrulamasından sonra constraint isimleri, kolon adları, CHECK'ler
-- gerçek değerlere göre yazıldı (tahmin yok).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ArsivBolum tablosunu oluştur
-- ---------------------------------------------------------------------------

CREATE TABLE "arsiv_bolum" (
  "id"                SERIAL NOT NULL,
  "ad"                VARCHAR(100) NOT NULL,
  "kod"               VARCHAR(3) NOT NULL,
  "renk_hex"          CHAR(7) NOT NULL DEFAULT '#888780',
  "sira_no"           INTEGER NOT NULL DEFAULT 0,
  "aktif_mi"          BOOLEAN NOT NULL DEFAULT TRUE,
  "olusturma_tarihi"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "guncelleme_tarihi" TIMESTAMPTZ(3),

  CONSTRAINT "arsiv_bolum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arsiv_bolum_ad_key"  ON "arsiv_bolum"("ad");
CREATE UNIQUE INDEX "arsiv_bolum_kod_key" ON "arsiv_bolum"("kod");

ALTER TABLE "arsiv_bolum"
  ADD CONSTRAINT "ck_arsiv_bolum_kod_format"  CHECK ("kod" ~ '^[A-Z]{3}$');
ALTER TABLE "arsiv_bolum"
  ADD CONSTRAINT "ck_arsiv_bolum_renk_format" CHECK ("renk_hex" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "arsiv_bolum"
  ADD CONSTRAINT "ck_arsiv_bolum_ad_nonempty" CHECK (LENGTH(TRIM("ad")) > 0);

-- ---------------------------------------------------------------------------
-- 2. Personnel'den 25 unique bolum'u + hardcoded kısa kod + renk ile insert
--    Eski 10 departman renkleri yeni karşılıklarına taşınır,
--    diğer 15 bolum default gri (#888780) ile başlar.
-- ---------------------------------------------------------------------------

INSERT INTO "arsiv_bolum" ("ad", "kod", "renk_hex", "sira_no", "aktif_mi")
SELECT
  bolum_ad,
  CASE bolum_ad
    WHEN 'KALİTE MÜDÜRLÜĞÜ'             THEN 'KAL'
    WHEN 'MEKANİK MONTAJ'               THEN 'MMT'
    WHEN 'KAYNAKHANE'                   THEN 'KYN'
    WHEN 'FİNANS MUHASEBE MÜDÜRLÜĞÜ'    THEN 'FMM'
    WHEN 'SATINALMA MÜDÜRLÜĞÜ'          THEN 'SAR'
    WHEN 'SATIŞ VE PAZ.MÜDÜRLÜĞÜ'       THEN 'SAT'
    WHEN 'İNSAN VARLIKLARI'             THEN 'IVK'
    WHEN 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ'  THEN 'SGM'
    WHEN 'BAKIMHANE'                    THEN 'BAK'
    WHEN 'DEPO'                         THEN 'DEP'
    WHEN 'PLASTİK ENJEKSİYON'           THEN 'PEN'
    WHEN 'KALIPHANE'                    THEN 'KLP'
    WHEN 'FABRİKA MÜDÜRLÜĞÜ'            THEN 'FAB'
    WHEN 'MÜHENDİSLİK'                  THEN 'MHN'
    WHEN 'TALAŞLI İMALAT'               THEN 'TLI'
    WHEN 'ASANSÖR'                      THEN 'ASN'
    WHEN 'PAKETLEME & DİREKSİYON'       THEN 'PKD'
    WHEN 'PRESHANE'                     THEN 'PRS'
    WHEN 'LAZER & DAİRE TESTERE'        THEN 'LZR'
    WHEN 'İDARİ İŞLER'                  THEN 'IDR'
    WHEN 'PROTOTİP ATÖLYE'              THEN 'PRT'
    WHEN 'YATIRIM VE TEŞVİK'            THEN 'YAT'
    WHEN 'GENEL MÜDÜRLÜK'               THEN 'GMD'
    WHEN 'YENİ İŞ GELİŞTİRME'           THEN 'YIG'
    WHEN 'ASANSÖR SATIŞ PAZARLAMA'      THEN 'ASP'
  END AS kod,
  CASE bolum_ad
    -- 10 eski departman → renkleri taşınır
    WHEN 'KALİTE MÜDÜRLÜĞÜ'            THEN '#1D9E75'
    WHEN 'SATIŞ VE PAZ.MÜDÜRLÜĞÜ'      THEN '#EF9F27'
    WHEN 'FİNANS MUHASEBE MÜDÜRLÜĞÜ'   THEN '#888780'
    WHEN 'İNSAN VARLIKLARI'            THEN '#7F77DD'
    WHEN 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ' THEN '#534AB7'
    WHEN 'BAKIMHANE'                   THEN '#854F0B'
    WHEN 'SATINALMA MÜDÜRLÜĞÜ'         THEN '#D85A30'
    WHEN 'MÜHENDİSLİK'                 THEN '#0EA5E9'
    WHEN 'FABRİKA MÜDÜRLÜĞÜ'           THEN '#378ADD'
    WHEN 'MEKANİK MONTAJ'              THEN '#475569'
    -- diğer 15 bolum default gri
    ELSE '#888780'
  END AS renk_hex,
  ROW_NUMBER() OVER (ORDER BY bolum_ad) AS sira_no,
  TRUE
FROM (
  SELECT DISTINCT p."bolum" AS bolum_ad
  FROM "Personnel" p
  WHERE p."aktif" = TRUE
    AND p."bolum" IS NOT NULL
    AND TRIM(p."bolum") != ''
) unique_bolumler;

-- Sanity: hardcoded mapping'de olmayan bolum varsa kod NULL olur, NOT NULL fail eder.
-- Buraya gelmiş olmamız mapping'in tam olduğunu gösterir.
DO $$
DECLARE
  bolum_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bolum_count FROM "arsiv_bolum";
  RAISE NOTICE '✓ ArsivBolum: % satır oluşturuldu', bolum_count;
END $$;

-- ---------------------------------------------------------------------------
-- 3. arsiv_evrak_turu: departman_id → bolum_id
--    100 satır var, mapping yapılır, sonra kolon değiştirilir.
-- ---------------------------------------------------------------------------

-- 3a. bolum_id kolonu ekle (NULLABLE başla)
ALTER TABLE "arsiv_evrak_turu" ADD COLUMN "bolum_id" INTEGER;

-- 3b. Eski 10 ArsivDepartman.kod → yeni ArsivBolum.ad mapping
UPDATE "arsiv_evrak_turu" et
SET "bolum_id" = b.id
FROM "arsiv_departman" d, "arsiv_bolum" b
WHERE et."departman_id" = d.id
  AND b."ad" = (
    CASE d."kod"
      WHEN 'KAL' THEN 'KALİTE MÜDÜRLÜĞÜ'
      WHEN 'SAT' THEN 'SATIŞ VE PAZ.MÜDÜRLÜĞÜ'
      WHEN 'MUH' THEN 'FİNANS MUHASEBE MÜDÜRLÜĞÜ'
      WHEN 'INS' THEN 'İNSAN VARLIKLARI'
      WHEN 'BIL' THEN 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ'
      WHEN 'BAK' THEN 'BAKIMHANE'
      WHEN 'SAR' THEN 'SATINALMA MÜDÜRLÜĞÜ'
      WHEN 'TAS' THEN 'MÜHENDİSLİK'
      WHEN 'URP' THEN 'FABRİKA MÜDÜRLÜĞÜ'
      WHEN 'URT' THEN 'MEKANİK MONTAJ'
    END
  );

-- 3c. Sanity check: orphan kalmamalı
DO $$
DECLARE
  orphan_count INTEGER;
  total_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "arsiv_evrak_turu" WHERE "bolum_id" IS NULL;
  SELECT COUNT(*) INTO total_count  FROM "arsiv_evrak_turu";

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: % evrak türü remap edilemedi (toplam: %)', orphan_count, total_count;
  END IF;

  RAISE NOTICE '✓ ArsivEvrakTuru: %/100 satır remap edildi', total_count;
END $$;

-- 3d. NOT NULL
ALTER TABLE "arsiv_evrak_turu" ALTER COLUMN "bolum_id" SET NOT NULL;

-- 3e. Eski FK ve unique index'i kaldır
-- (Prisma @@unique with map: name yields a UNIQUE INDEX, not a CONSTRAINT)
ALTER TABLE "arsiv_evrak_turu" DROP CONSTRAINT "arsiv_evrak_turu_departman_id_fkey";
DROP INDEX "uq_arsiv_evrak_turu_dept_ad";

-- 3f. Yeni FK ve unique index
ALTER TABLE "arsiv_evrak_turu"
  ADD CONSTRAINT "arsiv_evrak_turu_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "arsiv_bolum"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE UNIQUE INDEX "uq_arsiv_evrak_turu_bolum_ad"
  ON "arsiv_evrak_turu" ("bolum_id", "ad");

-- 3g. Eski kolonu drop
ALTER TABLE "arsiv_evrak_turu" DROP COLUMN "departman_id";

-- ---------------------------------------------------------------------------
-- 4. arsiv_koli: departman_id → bolum_id (boş tablo)
-- ---------------------------------------------------------------------------

ALTER TABLE "arsiv_koli" DROP CONSTRAINT "arsiv_koli_departman_id_fkey";
DROP INDEX "ix_arsiv_koli_dept_durum";

-- bolum_id ekle (boş tablo, DEFAULT 1 ile NOT NULL geçer; sonra DROP DEFAULT)
ALTER TABLE "arsiv_koli" ADD COLUMN "bolum_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "arsiv_koli" ALTER COLUMN "bolum_id" DROP DEFAULT;
ALTER TABLE "arsiv_koli" DROP COLUMN "departman_id";

ALTER TABLE "arsiv_koli"
  ADD CONSTRAINT "arsiv_koli_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "arsiv_bolum"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX "ix_arsiv_koli_bolum_durum" ON "arsiv_koli" ("bolum_id", "durum");

-- ---------------------------------------------------------------------------
-- 5. arsiv_sayac: composite PK (departman_id, yil) → (bolum_id, yil)
--    Boş tablo. PK olduğu için önce DROP CONSTRAINT, sonra kolon swap.
-- ---------------------------------------------------------------------------

ALTER TABLE "arsiv_sayac" DROP CONSTRAINT "arsiv_sayac_pkey";
ALTER TABLE "arsiv_sayac" DROP CONSTRAINT "arsiv_sayac_departman_id_fkey";

ALTER TABLE "arsiv_sayac" ADD COLUMN "bolum_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "arsiv_sayac" ALTER COLUMN "bolum_id" DROP DEFAULT;
ALTER TABLE "arsiv_sayac" DROP COLUMN "departman_id";

ALTER TABLE "arsiv_sayac"
  ADD CONSTRAINT "arsiv_sayac_pkey" PRIMARY KEY ("bolum_id", "yil");

ALTER TABLE "arsiv_sayac"
  ADD CONSTRAINT "arsiv_sayac_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "arsiv_bolum"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 6. arsiv_departman tablosunu DROP
-- ---------------------------------------------------------------------------
DROP TABLE "arsiv_departman";

-- ---------------------------------------------------------------------------
-- 7. Final
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  b_count INTEGER;
  e_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO b_count FROM "arsiv_bolum";
  SELECT COUNT(*) INTO e_count FROM "arsiv_evrak_turu";
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'Refactor tamamlandı:';
  RAISE NOTICE '  ArsivBolum:     % satır', b_count;
  RAISE NOTICE '  ArsivEvrakTuru: % satır', e_count;
  RAISE NOTICE '════════════════════════════════════════';
END $$;

COMMIT;

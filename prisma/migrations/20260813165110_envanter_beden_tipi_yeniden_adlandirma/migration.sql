-- Envanter beden tipi enum yeniden adlandirma (dev/elif/envanter-duzeltmeler @ 393ac69)
--
-- ELLE DUZELTILDI: Prisma'nin urettigi
--     USING ("bedenTipi"::text::"EnvanterBedenTipi_new")
-- calisma aninda patlar; eski degerlerin (YOK/UST/ALT/AYAKKABI/ELDIVEN) HICBIRI
-- yeni enum'da yok. Duz cast yerine CASE ile acik esleme yazildi.
-- Prisma'nin DROP DEFAULT adimi DOGRUYDU, korundu (sadece basa alindi).
-- Sondaki tekrar eden "-- AlterTable ... SET DEFAULT" satiri gereksizdi, kaldirildi.

BEGIN;

-- 1) DEFAULT kaldir (aksi halde tip donusumu "default cannot be cast" verir)
ALTER TABLE "public"."envanter_urun" ALTER COLUMN "bedenTipi" DROP DEFAULT;

-- 2) Yeni tip
CREATE TYPE "EnvanterBedenTipi_new" AS ENUM (
  'STANDART', 'UST_BEDEN', 'ALT_BEDEN', 'AYAKKABI_NO', 'ELDIVEN_NO'
);

-- 3) Kolonu CASE ile esleyerek cevir
--    YOK→STANDART · UST→UST_BEDEN · ALT→ALT_BEDEN
--    AYAKKABI→AYAKKABI_NO · ELDIVEN→ELDIVEN_NO
--    ELSE yok: beklenmeyen bir deger cikarsa NULL uretir, kolon NOT NULL
--    oldugu icin islem GURULTULU sekilde patlar (sessiz veri kaybi olmaz).
ALTER TABLE "public"."envanter_urun"
  ALTER COLUMN "bedenTipi" TYPE "EnvanterBedenTipi_new"
  USING (
    CASE "bedenTipi"::text
      WHEN 'YOK'      THEN 'STANDART'
      WHEN 'UST'      THEN 'UST_BEDEN'
      WHEN 'ALT'      THEN 'ALT_BEDEN'
      WHEN 'AYAKKABI' THEN 'AYAKKABI_NO'
      WHEN 'ELDIVEN'  THEN 'ELDIVEN_NO'
    END
  )::"EnvanterBedenTipi_new";

-- 4) Tip adlarini takasla, eskisini dusur
ALTER TYPE "EnvanterBedenTipi" RENAME TO "EnvanterBedenTipi_old";
ALTER TYPE "EnvanterBedenTipi_new" RENAME TO "EnvanterBedenTipi";
DROP TYPE "public"."EnvanterBedenTipi_old";

-- 5) Yeni DEFAULT
ALTER TABLE "public"."envanter_urun" ALTER COLUMN "bedenTipi" SET DEFAULT 'STANDART';

COMMIT;

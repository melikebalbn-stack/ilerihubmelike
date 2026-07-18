-- IPRO kiosk — ADIM A: SADECE enum degeri. Baska HICBIR sey eklenmeyecek.
--
-- NEDEN AYRI MIGRATION:
--   PG14'te ALTER TYPE ... ADD VALUE transaction icinde CALISIR, ancak yeni deger
--   AYNI transaction icinde KULLANILAMAZ ("unsafe use of new value of enum type").
--   Prisma her migration'i tek transaction'a sarar. Bu yuzden 'KIOSK'a referans veren
--   her sey (tablo default'u, backfill, vb.) AYRI ve SONRAKI bir migration'da olmali.
--   Model tablolari icin bkz. 20260715201903_ipro_kiosk.
--
-- ADDITIVE + GERI UYUMLU: rol kontrolleri allow-list oldugu icin yeni deger
-- hicbir yetkiyi acmaz (default-deny). Eski kod bu degeri hic gormez.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'KIOSK';

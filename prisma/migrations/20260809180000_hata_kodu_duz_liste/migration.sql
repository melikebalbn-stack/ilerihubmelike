-- KAL-KYT-15 Bölüm 1: hata kodu hiyerarşisi KALDIRILIYOR — düz liste.
--
-- Gerekçe: kaynak Excel'de tek düz liste var (kod + hata adı). Üst/alt kod ilişkisi
-- kaynakta YOKTU, sonradan eklenmişti ve istenmiyor.
--
-- VERİ KAYBI: yalnız "ustKodId" kolonu düşer. 126 kodun kendisi, adları, aktif/pasif
-- durumu, siraNo ve açıklamaları AYNEN KALIR. Kod değerlerine dokunulmaz
-- (873 geçmiş kayıt onlara bağlı).
--
-- ÜRETİM YÖNTEMİ: `migrate diff --from-schema <origin/main şeması> --to-schema <yeni şema>`.
-- Task'taki `--from-config-datasource` KULLANILMADI: o, .env'deki staging DB'sine bakıyor,
-- staging'de ise HataKodu tablosu hiç YOK (migration oraya hiç uygulanmadı) → beklenen
-- DROP'lar yerine CREATE TABLE + staging drift'inden gelen alakasız ifadeler üretirdi.
-- Şema-şema diff hiçbir DB'ye dokunmaz; çıktı birebir aşağıdaki üç ifade, fazlası yok.

-- DropForeignKey
ALTER TABLE "HataKodu" DROP CONSTRAINT "HataKodu_ustKodId_fkey";

-- DropIndex
DROP INDEX "HataKodu_ustKodId_idx";

-- AlterTable
ALTER TABLE "HataKodu" DROP COLUMN "ustKodId";

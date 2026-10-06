-- Toplantı kararı: açıklama opsiyonel
--
-- ADDITIVE: yalnız NOT NULL kısıtı kaldırılıyor. Mevcut satırlar (4 karar)
-- dolu olduğu için veri dönüşümü yok, backfill yok, varsayılan yok.
-- Geri alma: önce boş açıklamaları doldur/temizle, sonra SET NOT NULL.

-- AlterTable
ALTER TABLE "MeetingDecision" ALTER COLUMN "description" DROP NOT NULL;

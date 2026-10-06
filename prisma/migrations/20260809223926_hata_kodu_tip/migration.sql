-- CreateEnum
CREATE TYPE "HataKoduTip" AS ENUM ('BOLUM', 'KOD');

-- AlterTable
ALTER TABLE "HataKodu" ADD COLUMN     "tip" "HataKoduTip" NOT NULL DEFAULT 'KOD';

-- CreateIndex
CREATE INDEX "HataKodu_tip_idx" ON "HataKodu"("tip");

-- ── BACKFILL ──
-- Bugüne kadar türetilmiş olan ayrımı veriye sabitler:
--   ustKodId NULL  VE  en az bir alt kaydı var   -> BOLUM
--   diğer her şey                                -> KOD
-- Adlar şemadan doğrulandı: tablo "HataKodu" (@@map yok), kolonlar "ustKodId"/"tip"/"id",
-- enum tipi "HataKoduTip".
-- Bugünkü prod verisiyle beklenen sonuç: toplam 126 · BOLUM 18 · KOD 108
-- (9 genel uygunsuzluk KOD tarafına düşer — üstü yok ama altı da yok).

-- Bölümler: üstü olmayan VE altı olan kayıtlar
UPDATE "HataKodu" h
SET "tip" = 'BOLUM'::"HataKoduTip"
WHERE h."ustKodId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "HataKodu" c WHERE c."ustKodId" = h."id"
  );

-- Geri kalan her şey: alt kodlar + altı olmayan kökler (genel uygunsuzluklar).
-- Kolon DEFAULT 'KOD' NOT NULL geldiği için mevcut satırlarda no-op'tur;
-- kuralın tamamı dosyada görünsün diye açıkça yazıldı. İdempotent.
UPDATE "HataKodu" h
SET "tip" = 'KOD'::"HataKoduTip"
WHERE NOT (
  h."ustKodId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "HataKodu" c WHERE c."ustKodId" = h."id"
  )
);

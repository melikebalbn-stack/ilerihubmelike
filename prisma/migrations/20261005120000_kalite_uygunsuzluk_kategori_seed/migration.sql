-- Uygunsuzluk kategorileri icin baslangic kayitlari (Melike'nin onerisi, Melih onayi).
-- Veri eklemesi; sema degismiyor. Idempotent: ad benzersiz, cakisirsa atlanir.

INSERT INTO "KaliteUygunsuzlukKategori" ("id", "ad", "aktif", "siraNo", "createdAt", "updatedAt")
VALUES
  ('kuk_olcusel', 'Ölçüsel', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kuk_gorsel',  'Görsel',  true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("ad") DO NOTHING;

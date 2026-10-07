-- Kadro (personel) talebi — pozisyon adı org şemasından seçilir (07.10.2026).
-- ADDITIVE: iki nullable/default kolon. Mevcut satırlara DOKUNULMAZ, backfill YOK:
-- eski kayıtlar (kod NULL + semaYok false) "eski serbest metin" olarak okunur.
ALTER TABLE "PersonnelRequest" ADD COLUMN IF NOT EXISTS "pozisyonOrgKodu" TEXT;
ALTER TABLE "PersonnelRequest" ADD COLUMN IF NOT EXISTS "pozisyonSemadaYok" BOOLEAN NOT NULL DEFAULT false;

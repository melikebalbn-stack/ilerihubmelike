-- Tanımlar ekranı: Position'a yaka + İngilizce zorunlu (additive nullable, mevcut veri dokunulmaz).
ALTER TABLE "Position" ADD COLUMN "yaka" TEXT;
ALTER TABLE "Position" ADD COLUMN "ingilizceZorunlu" BOOLEAN NOT NULL DEFAULT false;

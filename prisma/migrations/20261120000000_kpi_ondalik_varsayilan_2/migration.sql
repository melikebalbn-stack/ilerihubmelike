-- KPI-ONDALIK: varsayılan basamak sayısı 4'ten 2'ye düşürüldü (Melike: "Tüm alanlarda veriler
-- virgülden sonra 2 hane"). Henüz kimse elle farklı bir değer seçmediği için (alan yeni),
-- hâlâ eski varsayılanda (4) duran satırlar yeni varsayılana (2) çekiliyor — özellikle
-- özelleştirilmiş bir KPI varsa dokunulmuyor.
ALTER TABLE "KPIDefinition" ALTER COLUMN "ondalikBasamak" SET DEFAULT 2;

UPDATE "KPIDefinition" SET "ondalikBasamak" = 2 WHERE "ondalikBasamak" = 4;

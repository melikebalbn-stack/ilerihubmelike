-- IPRO üretim satırına plan snapshot alanları (çalışıyor ekranı zenginleştirme).
-- "başla" anında ShopOrderOperations'tan otoriter çekilir; nullable, additive.
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsQtyDue" INTEGER;
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsDueDate" TIMESTAMP(3);
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsNeedDate" TIMESTAMP(3);
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsMachRunFactor" DOUBLE PRECISION;
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsLaborRunFactor" DOUBLE PRECISION;
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsRunTimeCode" TEXT;

-- IPRO üretim satırına malzeme snapshot alanları (FAZ 2 pano zenginleştirme).
-- "başla" anında IFS ShopOrderOperations'tan otoriter çekilip yazılır; nullable
-- (IFS erişilemezse null, iş yine başlar). Additive-only; geri-uyumlu.
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsPartNo" TEXT;
ALTER TABLE "ipro_production_log" ADD COLUMN IF NOT EXISTS "ifsPartDescription" TEXT;

-- MAS MES ayna: IproProductionLog idempotency anahtarları + index/unique
ALTER TABLE "ipro_production_log" ADD COLUMN "masProductionMasterId" INTEGER;
ALTER TABLE "ipro_production_log" ADD COLUMN "masProductionDetayId" INTEGER;

CREATE INDEX "ipro_prodlog_mas_idx" ON "ipro_production_log"("masProductionMasterId");

-- Aynı MAS üretim+iş emri+operasyon iki kez yazılmasın (nullable → non-MAS kayıtlar çakışmaz).
CREATE UNIQUE INDEX "ipro_prodlog_mas_uq"
  ON "ipro_production_log"("masProductionMasterId", "ifsOrderNo", "ifsOperationNo");

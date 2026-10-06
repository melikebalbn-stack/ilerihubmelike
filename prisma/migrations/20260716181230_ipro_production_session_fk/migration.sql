-- IPRO §7.2 — IproProductionLog.sessionId zorunlu FK.
-- ON KOSUL: ipro_production_log BOS (0 satir) — NOT NULL kolon default'suz eklenebilir.
-- Additive-only. onDelete RESTRICT: oturum silinirse uretim kaydi korunur (denetim izi).

-- AlterTable
ALTER TABLE "ipro_production_log" ADD COLUMN     "sessionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ipro_production_log_sessionId_idx" ON "ipro_production_log"("sessionId");

-- AddForeignKey
ALTER TABLE "ipro_production_log" ADD CONSTRAINT "ipro_production_log_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ipro_operator_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

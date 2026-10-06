-- ADIM 0 temiz döndükten SONRA. Additive-only. NOT NULL+DEFAULT → PG11+ rewrite yok.

CREATE TYPE "IproAuthMethod" AS ENUM ('LIST', 'CARD');

ALTER TABLE "ipro_operator_session"
  ADD COLUMN "authMethod" "IproAuthMethod" NOT NULL DEFAULT 'LIST';

CREATE INDEX "ipro_operator_session_personnelId_cikisAt_idx"
  ON "ipro_operator_session"("personnelId", "cikisAt");

-- Tek ACTIVE / (operatör, tezgah). Aynı tezgahta ÇOK operatör serbest (index çift kolonlu).
CREATE UNIQUE INDEX "ipro_operator_session_one_active_per_op_tezgah"
  ON "ipro_operator_session"("personnelId", "tezgahId") WHERE "cikisAt" IS NULL;

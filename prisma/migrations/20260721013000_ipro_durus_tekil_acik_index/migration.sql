-- Kiosk duruş akışı: tezgah başına EN FAZLA BİR açık duruş (bitis IS NULL).
-- Partial unique index — Prisma @@unique partial ifade edemez, elle eklenir.
-- Additive; mevcut kayıtları etkilemez (kapalı duruşlar bitis dolu).
CREATE UNIQUE INDEX IF NOT EXISTS "ipro_machine_downtime_acik_uq"
  ON "ipro_machine_downtime" ("tezgahId")
  WHERE "bitis" IS NULL;

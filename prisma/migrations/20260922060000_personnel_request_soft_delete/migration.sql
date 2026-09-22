-- PersonnelRequest soft delete (additive): silindiMi + silenId + silinmeTarihi
ALTER TABLE "PersonnelRequest" ADD COLUMN "silindiMi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PersonnelRequest" ADD COLUMN "silenId" TEXT;
ALTER TABLE "PersonnelRequest" ADD COLUMN "silinmeTarihi" TIMESTAMP(3);

CREATE INDEX "PersonnelRequest_silindiMi_idx" ON "PersonnelRequest"("silindiMi");

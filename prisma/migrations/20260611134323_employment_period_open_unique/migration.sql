-- PR-A: "Tek açık dönem" invariant'ı (Prisma @@unique ifade edemez — RAW partial index).
-- cikisTarihi IS NULL olan satırlar arasında personnelId benzersiz.
CREATE UNIQUE INDEX "EmploymentPeriod_one_open_per_personnel"
  ON "EmploymentPeriod"("personnelId") WHERE "cikisTarihi" IS NULL;

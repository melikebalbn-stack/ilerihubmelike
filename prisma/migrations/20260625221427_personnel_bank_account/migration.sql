-- CreateTable
CREATE TABLE "PersonnelBankAccount" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "bankaAdi" TEXT,
    "bankaSube" TEXT,
    "hesapNo" TEXT,
    "ibanNo" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "PersonnelBankAccount_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PersonnelBankAccount_personnelId_idx" ON "PersonnelBankAccount"("personnelId");
-- CreateIndex
CREATE UNIQUE INDEX "PersonnelBankAccount_personnelId_ibanNo_key" ON "PersonnelBankAccount"("personnelId", "ibanNo");
-- AddForeignKey
ALTER TABLE "PersonnelBankAccount" ADD CONSTRAINT "PersonnelBankAccount_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PR-1: kişi başına en fazla BİR primary hesap garantisi.
-- Kısmi (partial) unique index — Prisma @@unique WHERE ifade edemediği için elle eklendi.
CREATE UNIQUE INDEX "PersonnelBankAccount_personnelId_primary_key"
    ON "PersonnelBankAccount"("personnelId") WHERE "isPrimary";

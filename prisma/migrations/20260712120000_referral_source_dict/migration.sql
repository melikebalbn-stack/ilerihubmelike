-- Kaynak sözlüğü — yönetilebilir liste. Eski referralSource ENUM kolonu DROP EDİLMEZ (geriye dönük).
-- CreateTable
CREATE TABLE "ReferralSourceDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralSourceDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralSourceDef_name_key" ON "ReferralSourceDef"("name");

-- CreateIndex
CREATE INDEX "ReferralSourceDef_isActive_idx" ON "ReferralSourceDef"("isActive");

-- AlterTable (yalnız 1 nullable FK kolonu; eski enum kolonu DURUYOR)
ALTER TABLE "PublicJobApplication" ADD COLUMN "referralSourceId" TEXT;

-- CreateIndex
CREATE INDEX "PublicJobApplication_referralSourceId_idx" ON "PublicJobApplication"("referralSourceId");

-- AddForeignKey
ALTER TABLE "PublicJobApplication" ADD CONSTRAINT "PublicJobApplication_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ReferralSourceDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

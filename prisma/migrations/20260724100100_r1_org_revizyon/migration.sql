-- CreateTable
CREATE TABLE "OrgRevizyon" (
    "id" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "revNo" INTEGER NOT NULL,
    "tarih" DATE NOT NULL,
    "aciklama" TEXT NOT NULL,
    "degisiklikYeri" TEXT NOT NULL,
    "yapan" TEXT NOT NULL,
    "yapanUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgRevizyon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgRevizyon_orgUnitId_idx" ON "OrgRevizyon"("orgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRevizyon_orgUnitId_revNo_key" ON "OrgRevizyon"("orgUnitId", "revNo");

-- AddForeignKey
ALTER TABLE "OrgRevizyon" ADD CONSTRAINT "OrgRevizyon_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

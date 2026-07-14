-- CreateTable
CREATE TABLE "envanter_personel_beden_profili" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "ustBeden" TEXT,
    "altBeden" TEXT,
    "ayakkabiNo" TEXT,
    "eldivenNo" TEXT,
    "olcuTarihi" TIMESTAMP(3),
    "not" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_personel_beden_profili_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envanter_personel_beden_profili_personnelId_key" ON "envanter_personel_beden_profili"("personnelId");

-- CreateIndex
CREATE INDEX "envanter_personel_beden_profili_personnelId_idx" ON "envanter_personel_beden_profili"("personnelId");

-- AddForeignKey
ALTER TABLE "envanter_personel_beden_profili" ADD CONSTRAINT "envanter_personel_beden_profili_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


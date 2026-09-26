-- CreateTable
CREATE TABLE "ipro_mola_tanim" (
    "id" TEXT NOT NULL,
    "vardiyaId" TEXT NOT NULL,
    "bolum" TEXT,
    "sebepId" TEXT NOT NULL,
    "baslangic" TEXT NOT NULL,
    "sureDk" INTEGER NOT NULL,
    "gunMaskesi" INTEGER NOT NULL,
    "gecerliBaslangic" TIMESTAMP(3),
    "gecerliBitis" TIMESTAMP(3),
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "masDowntimeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_mola_tanim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ipro_mola_tanim_bolum_aktif_idx" ON "ipro_mola_tanim"("bolum", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_mola_tanim_uq" ON "ipro_mola_tanim"("vardiyaId", "bolum", "sebepId", "baslangic", "gunMaskesi");

-- AddForeignKey
ALTER TABLE "ipro_mola_tanim" ADD CONSTRAINT "ipro_mola_tanim_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "ipro_vardiya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_mola_tanim" ADD CONSTRAINT "ipro_mola_tanim_sebepId_fkey" FOREIGN KEY ("sebepId") REFERENCES "ipro_durus_sebebi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


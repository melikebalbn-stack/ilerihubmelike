-- CreateTable
CREATE TABLE "izin_hatirlatma" (
    "id" TEXT NOT NULL,
    "anahtar" TEXT NOT NULL,
    "talepId" TEXT,
    "erkenDonusId" TEXT,
    "kademe" TEXT NOT NULL,
    "aliciSayisi" INTEGER NOT NULL DEFAULT 0,
    "gonderildiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_hatirlatma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "izin_hatirlatma_anahtar_key" ON "izin_hatirlatma"("anahtar");

-- CreateIndex
CREATE INDEX "izin_hatirlatma_talepId_idx" ON "izin_hatirlatma"("talepId");

-- AddForeignKey
ALTER TABLE "izin_hatirlatma" ADD CONSTRAINT "izin_hatirlatma_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "izin_talep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_hatirlatma" ADD CONSTRAINT "izin_hatirlatma_erkenDonusId_fkey" FOREIGN KEY ("erkenDonusId") REFERENCES "izin_erken_donus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


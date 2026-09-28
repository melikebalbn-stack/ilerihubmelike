-- Bölüm Değişikliği Talep Formu (additive)
CREATE TYPE "BolumTalepDurum" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI', 'IPTAL');
CREATE TYPE "BolumTalepAcanRol" AS ENUM ('MUDUR', 'MUDUR_YRD');

CREATE TABLE "bolum_degisiklik_talep" (
    "id" TEXT NOT NULL,
    "talepNo" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "acanUserId" TEXT NOT NULL,
    "acanPersonnelId" TEXT,
    "acanRol" "BolumTalepAcanRol" NOT NULL,
    "acanBolum" TEXT,
    "mevcutBolum" TEXT NOT NULL,
    "hedefBolum" TEXT NOT NULL,
    "talepTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferTarihi" DATE,
    "gerekceler" TEXT[],
    "gerekceAciklamasi" TEXT,
    "gerekceDigerKisi" TEXT,
    "gerekceDigerIs" TEXT,
    "durum" "BolumTalepDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "kararVerenId" TEXT,
    "kararTarihi" TIMESTAMP(3),
    "redGerekcesi" TEXT,
    "isgOnayi" "TransferOnay",
    "doktorOnayi" "TransferOnay",
    "transferId" TEXT,
    "personelOnayi" "TransferOnay",
    "personelOnayTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bolum_degisiklik_talep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bolum_degisiklik_talep_talepNo_key" ON "bolum_degisiklik_talep"("talepNo");
CREATE UNIQUE INDEX "bolum_degisiklik_talep_transferId_key" ON "bolum_degisiklik_talep"("transferId");
CREATE INDEX "bolum_degisiklik_talep_durum_idx" ON "bolum_degisiklik_talep"("durum");
CREATE INDEX "bolum_degisiklik_talep_personnelId_idx" ON "bolum_degisiklik_talep"("personnelId");
CREATE INDEX "bolum_degisiklik_talep_acanUserId_idx" ON "bolum_degisiklik_talep"("acanUserId");
CREATE INDEX "bolum_degisiklik_talep_hedefBolum_idx" ON "bolum_degisiklik_talep"("hedefBolum");

-- Aynı personel için AYNI ANDA tek BEKLIYOR talep (kısmi unique index; Prisma
-- şemasında ifade edilemez, uygulama katmanı da ayrıca kontrol eder).
CREATE UNIQUE INDEX "uq_bolum_talep_bekleyen_personel"
    ON "bolum_degisiklik_talep"("personnelId")
    WHERE "durum" = 'BEKLIYOR';

ALTER TABLE "bolum_degisiklik_talep" ADD CONSTRAINT "bolum_degisiklik_talep_personnelId_fkey"
    FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bolum_degisiklik_talep" ADD CONSTRAINT "bolum_degisiklik_talep_acanUserId_fkey"
    FOREIGN KEY ("acanUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bolum_degisiklik_talep" ADD CONSTRAINT "bolum_degisiklik_talep_kararVerenId_fkey"
    FOREIGN KEY ("kararVerenId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bolum_degisiklik_talep" ADD CONSTRAINT "bolum_degisiklik_talep_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "personnel_department_transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

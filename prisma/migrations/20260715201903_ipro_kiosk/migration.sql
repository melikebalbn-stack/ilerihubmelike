-- IPRO kiosk — ADIM B: modeller. Enum degeri 20260715201803_role_kiosk_enum'da EKLENDI.
-- Bu dosya 'KIOSK' enum degerine REFERANS VERMEZ (PG14 ayni-transaction kisiti).
--
-- ipro_kiosk.userId -> User RESTRICT: kiosk kaydi dururken User silinemez.
-- ipro_kiosk_tezgah FK'leri CASCADE: IproDurusTezgah/IproHurdaTezgah/PersonnelWorkstation
--   join deseniyle tutarli — cihaz veya tezgah silinince esleme dusler.
-- sifreHash NOT NULL: kiosk sifresiz var olamaz. bcrypt (pin-utils.hashPin, saltRounds=10).

-- CreateTable
CREATE TABLE "ipro_kiosk" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGirisAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_kiosk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_kiosk_tezgah" (
    "id" TEXT NOT NULL,
    "kioskId" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipro_kiosk_tezgah_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ipro_kiosk_kod_key" ON "ipro_kiosk"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_kiosk_userId_key" ON "ipro_kiosk"("userId");

-- CreateIndex
CREATE INDEX "ipro_kiosk_aktif_idx" ON "ipro_kiosk"("aktif");

-- CreateIndex
CREATE INDEX "ipro_kiosk_tezgah_tezgahId_idx" ON "ipro_kiosk_tezgah"("tezgahId");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_kiosk_tezgah_kioskId_tezgahId_key" ON "ipro_kiosk_tezgah"("kioskId", "tezgahId");

-- AddForeignKey
ALTER TABLE "ipro_kiosk" ADD CONSTRAINT "ipro_kiosk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_kiosk_tezgah" ADD CONSTRAINT "ipro_kiosk_tezgah_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "ipro_kiosk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_kiosk_tezgah" ADD CONSTRAINT "ipro_kiosk_tezgah_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE CASCADE ON UPDATE CASCADE;


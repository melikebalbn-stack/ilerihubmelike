-- CreateTable
CREATE TABLE "proje_takip" (
    "id" TEXT NOT NULL,
    "projeNo" TEXT NOT NULL,
    "siraNo" INTEGER,
    "musteriFirma" TEXT NOT NULL,
    "musteriYetkilisi" TEXT,
    "musteriKod" TEXT,
    "ileriKod" TEXT,
    "ileriTanim" TEXT NOT NULL,
    "grupKod" TEXT,
    "kategori" TEXT,
    "kalipFikstur" TEXT,
    "kalipKodu" TEXT,
    "yillikAdet" DOUBLE PRECISION,
    "minimumSipMiktari" DOUBLE PRECISION,
    "numuneAdedi" TEXT,
    "prototipFiyati" DECIMAL(14,2),
    "prototipParaBirimi" TEXT,
    "nre" DECIMAL(14,2),
    "nreParaBirimi" TEXT,
    "projeKalipFikstur" TEXT,
    "projeBilgisi" TEXT,
    "rfpNo" TEXT,
    "rfpTarih" TIMESTAMP(3),
    "rfpAcilisHafta" INTEGER,
    "yil" INTEGER,
    "revizeTerminTrh" TIMESTAMP(3),
    "terminProjeTrh" TIMESTAMP(3),
    "poNumarasi" TEXT,
    "projeDurumTipi" TEXT,
    "sevkiyatTrh" TIMESTAMP(3),
    "sevkiyatYil" INTEGER,
    "sevkiyatHafta" INTEGER,
    "onayTrh" TIMESTAMP(3),
    "onayYil" INTEGER,
    "onayHafta" INTEGER,
    "aciklama" TEXT,
    "lokasyon" TEXT,
    "birimFiyat" DECIMAL(14,2),
    "birimFiyatParaBirimi" TEXT,
    "hedefYillik" DECIMAL(14,2),
    "kalipTutar" DECIMAL(14,2),
    "kickOffStatu" TEXT,
    "poKalip" TEXT,
    "kickoffCW" INTEGER,
    "kickoffYil" INTEGER,
    "istemeTrhCW" INTEGER,
    "istemeTrhYil" INTEGER,
    "sevkTrhCW" INTEGER,
    "sevkYil" INTEGER,
    "poTrhCW" INTEGER,
    "poYil" INTEGER,
    "poOngCW" INTEGER,
    "poOngYil" INTEGER,
    "legacyComboBox10" TEXT,
    "legacyComboBox23" TEXT,
    "legacyDateCombo5" TIMESTAMP(3),
    "legacyKullaniciStatic" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'YENI_DEVAM_EDEN',
    "muhendislikDoldurmaDurumu" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "muhendislikBildirimGonderildiMi" BOOLEAN NOT NULL DEFAULT false,
    "muhendislikBildirimTarihi" TIMESTAMP(3),
    "olusturanId" TEXT NOT NULL,
    "muhendislikSorumluId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proje_takip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proje_takip_log" (
    "id" TEXT NOT NULL,
    "projeTakipId" TEXT NOT NULL,
    "islemTipi" TEXT NOT NULL,
    "yapanId" TEXT NOT NULL,
    "detay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proje_takip_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proje_takip_projeNo_key" ON "proje_takip"("projeNo");

-- CreateIndex
CREATE INDEX "proje_takip_durum_idx" ON "proje_takip"("durum");

-- CreateIndex
CREATE INDEX "proje_takip_muhendislikSorumluId_idx" ON "proje_takip"("muhendislikSorumluId");

-- CreateIndex
CREATE INDEX "proje_takip_musteriFirma_idx" ON "proje_takip"("musteriFirma");

-- CreateIndex
CREATE INDEX "proje_takip_log_projeTakipId_idx" ON "proje_takip_log"("projeTakipId");

-- AddForeignKey
ALTER TABLE "proje_takip_log" ADD CONSTRAINT "proje_takip_log_projeTakipId_fkey" FOREIGN KEY ("projeTakipId") REFERENCES "proje_takip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


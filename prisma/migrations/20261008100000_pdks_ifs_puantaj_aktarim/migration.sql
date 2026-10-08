-- PDKS → IFS PUANTAJ (DEVAM) AKTARIMI (08.10.2026) — ADDITIVE.
-- İK kararı: Hub'da MAAŞ/ÜCRET bilgisi TUTULMAZ. Bu tablo yalnız DEVAM (gün/saat) özeti tutar;
-- ücret, ek ödeme, kesinti, net/brüt kolonu YOKTUR. Mevcut tablolara dokunulmaz.

CREATE TABLE "pdks_ifs_puantaj_aktarim" (
    "id" TEXT NOT NULL,
    "donem" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "sicil" TEXT,
    "adSoyad" TEXT NOT NULL,
    "calismaSaat" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "fazlaMesaiSaat" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "geceSaat" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "normalGun" INTEGER NOT NULL DEFAULT 0,
    "mesaiGun" INTEGER NOT NULL DEFAULT 0,
    "haftaTatiliGun" INTEGER NOT NULL DEFAULT 0,
    "resmiTatilGun" INTEGER NOT NULL DEFAULT 0,
    "izinGun" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "raporGun" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "eksikGun" INTEGER NOT NULL DEFAULT 0,
    "eksikKayitGun" INTEGER NOT NULL DEFAULT 0,
    "detayJson" JSONB,
    "durum" TEXT NOT NULL DEFAULT 'HAZIR',
    "ifsHata" TEXT,
    "gonderilenAt" TIMESTAMP(3),
    "gonderenId" TEXT,
    "hesaplananAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdks_ifs_puantaj_aktarim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pdks_ifs_puantaj_aktarim_donem_personnelId_key" ON "pdks_ifs_puantaj_aktarim"("donem", "personnelId");
CREATE INDEX "pdks_ifs_puantaj_aktarim_donem_durum_idx" ON "pdks_ifs_puantaj_aktarim"("donem", "durum");

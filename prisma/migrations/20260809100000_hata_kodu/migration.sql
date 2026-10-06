-- KAL-KYT-15 Bölüm 1: Kalite hata kodu ağacı. Additive — mevcut tabloya dokunmaz.
--
-- ⚠ ELLE TEMİZLENDİ: `prisma migrate diff` staging DB'ye karşı çalıştırıldı ve staging
--   main'den geride olduğu için ALAKASIZ ifadeler üretti (YillikTakvim* 10 tablo + 7 enum
--   CREATE; OtpChallenge DROP TABLE; User.passwordHash/mustChangePassword/passwordChangedAt
--   DROP COLUMN; OtpPurpose DROP TYPE). Bu dosyada YALNIZCA HataKodu ifadeleri bırakıldı.
--   Ham diff çıktısı kapsam dışı DDL içeriyordu — uygulanmadı.
--
-- Ağaç: ust'u olan = alt kod · ustKodId null + altı var = bölüm başlığı (SEÇİLEBİLİR)
--       ustKodId null + altı yok = genel uygunsuzluk (1..9).
-- Silme: onDelete RESTRICT — altı olan kod silinemez. Kullanımdaki kod aktif=false yapılır.

-- CreateTable
CREATE TABLE "HataKodu" (
    "id" TEXT NOT NULL,
    "kod" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "ustKodId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "siraNo" INTEGER NOT NULL,
    "aciklama" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HataKodu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HataKodu_kod_key" ON "HataKodu"("kod");

-- CreateIndex
CREATE INDEX "HataKodu_ustKodId_idx" ON "HataKodu"("ustKodId");

-- CreateIndex
CREATE INDEX "HataKodu_aktif_idx" ON "HataKodu"("aktif");

-- AddForeignKey
ALTER TABLE "HataKodu" ADD CONSTRAINT "HataKodu_ustKodId_fkey" FOREIGN KEY ("ustKodId") REFERENCES "HataKodu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Melih Bey onayıyla uygulanır. Sıra: 20261002070100_fif_paket4_enum'dan ÖNCE.
--
-- FİF (KAL-FR-10) Paket 3 — kaynak listesi, satır bazlı sorumlu/termin/etkinlik,
-- ek termin talebi, faaliyet bazlı geçmiş. DDL bölümü offline `prisma migrate diff`
-- (origin/main şeması → bu branch'in şeması, DB'ye bağlanmadan) çıktısıdır — Paket 4
-- dosyasındaki ALTER TYPE ile birlikte birebir.
-- VERİ AKTARIMI bölümü elle yazıldı.
--
-- YALNIZ EKLEYİCİ: DROP / DELETE / TRUNCATE YOK. Tek gevşetme: "Fif"."kayitNo"
-- NOT NULL kaldırılır (numara artık KSS "Kayda Al"da verilecek). Mevcut
-- "Fif_kayitNo_key" unique index'i korunur — PostgreSQL çoklu NULL'a izin verir.
-- Veri aktarımı yalnız BOŞ alanlara yazar (tekrar çalıştırılsa da mevcut değeri ezmez).

-- CreateEnum
CREATE TYPE "FifEkTerminDurum" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "FifGecmisOlay" AS ENUM ('DURUM_DEGISTI', 'FAALIYET_KAPATILDI', 'FAALIYET_YENIDEN_ACILDI', 'FAALIYET_YAPILAMADI', 'EK_TERMIN_TALEP', 'EK_TERMIN_ONAY', 'EK_TERMIN_RED', 'EK_TERMIN_IPTAL', 'ETKINLIK_KONTROL', 'IZLEME_SORUMLUSU_DEGISTI');

-- AlterTable
ALTER TABLE "Fif" ADD COLUMN     "kaynakId" TEXT,
ALTER COLUMN "kayitNo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FifFaaliyet" ADD COLUMN     "etkinlikHatirlatmaTarihi" TIMESTAMP(3),
ADD COLUMN     "etkinlikKontrolTarihi" TIMESTAMP(3),
ADD COLUMN     "etkinlikKontrolUserId" TEXT,
ADD COLUMN     "etkinlikPlanTarihi" TIMESTAMP(3),
ADD COLUMN     "etkinlikUygun" BOOLEAN,
ADD COLUMN     "ilkHedefTarih" TIMESTAMP(3),
ADD COLUMN     "sorumluUserId" TEXT;

-- AlterTable
ALTER TABLE "FifGecmis" ADD COLUMN     "faaliyetId" TEXT,
ADD COLUMN     "olay" "FifGecmisOlay";

-- CreateTable
CREATE TABLE "FifKaynak" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FifKaynak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifEkTermin" (
    "id" TEXT NOT NULL,
    "faaliyetId" TEXT NOT NULL,
    "talepEdenUserId" TEXT NOT NULL,
    "mevcutHedefTarih" TIMESTAMP(3),
    "istenenHedefTarih" TIMESTAMP(3) NOT NULL,
    "neden" TEXT NOT NULL,
    "durum" "FifEkTerminDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "kararUserId" TEXT,
    "kararTarihi" TIMESTAMP(3),
    "kararNotu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FifEkTermin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FifKaynak_ad_key" ON "FifKaynak"("ad");

-- CreateIndex
CREATE INDEX "FifEkTermin_faaliyetId_idx" ON "FifEkTermin"("faaliyetId");

-- CreateIndex
CREATE INDEX "FifEkTermin_durum_idx" ON "FifEkTermin"("durum");

-- CreateIndex
CREATE INDEX "Fif_kaynakId_idx" ON "Fif"("kaynakId");

-- CreateIndex
CREATE INDEX "FifFaaliyet_sorumluUserId_idx" ON "FifFaaliyet"("sorumluUserId");

-- CreateIndex
CREATE INDEX "FifFaaliyet_etkinlikPlanTarihi_idx" ON "FifFaaliyet"("etkinlikPlanTarihi");

-- CreateIndex
CREATE INDEX "FifGecmis_faaliyetId_idx" ON "FifGecmis"("faaliyetId");

-- AddForeignKey
ALTER TABLE "Fif" ADD CONSTRAINT "Fif_kaynakId_fkey" FOREIGN KEY ("kaynakId") REFERENCES "FifKaynak"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifEkTermin" ADD CONSTRAINT "FifEkTermin_faaliyetId_fkey" FOREIGN KEY ("faaliyetId") REFERENCES "FifFaaliyet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifGecmis" ADD CONSTRAINT "FifGecmis_faaliyetId_fkey" FOREIGN KEY ("faaliyetId") REFERENCES "FifFaaliyet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── VERİ AKTARIMI (yalnız boş alanlara) ─────────────────────────────────────

-- Satır sorumlusu ← formun uygulama sorumlusu (FİF başlığındaki tek kişi).
UPDATE "FifFaaliyet" AS f
SET "sorumluUserId" = fif."uygulamaSorumlusuUserId"
FROM "Fif" AS fif
WHERE f."fifId" = fif."id"
  AND f."sorumluUserId" IS NULL
  AND fif."uygulamaSorumlusuUserId" IS NOT NULL;

-- İlk hedef tarih ← mevcut hedef tarih.
-- NOT: ES (ek süre) verilmiş satırlarda hedefTarih zaten ESKİ tarihin üzerine
-- yazılmış olabilir; bu satırlarda ilkHedefTarih = son hedef tarih olur.
-- Kurtarma ayrı bir kontrollü adımda değerlendirilecek (bkz. Paket 3a raporu).
UPDATE "FifFaaliyet"
SET "ilkHedefTarih" = "hedefTarih"
WHERE "ilkHedefTarih" IS NULL
  AND "hedefTarih" IS NOT NULL;

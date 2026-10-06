-- IPRO §7.2 — IFS geri-yazım çift bayrak (complete/scrap ayrı izlenir).
-- Additive-only. Tüm kolonlar default/nullable → dolu tabloda da güvenli (burada tablo boş).
-- Eski ifsYazildi/ifsHata DOKUNULMADAN duruyor (ileride temizlenir — ayrı iş).

-- AlterTable
ALTER TABLE "ipro_production_log" ADD COLUMN     "ifsCompleteHata" TEXT,
ADD COLUMN     "ifsCompleteYazildi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ifsScrapHata" TEXT,
ADD COLUMN     "ifsScrapYazildi" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ipro_production_log_ifsCompleteYazildi_idx" ON "ipro_production_log"("ifsCompleteYazildi");

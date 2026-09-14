-- Adım 1: yeni nullable alanlar eklendi (additive)
ALTER TABLE "Invoice" ADD COLUMN     "departmentName" TEXT,
ADD COLUMN     "departmentOrgUnitId" TEXT;

-- Adım 2: mevcut kayıtlar yeni alanlara taşındı (data backfill, elle uygulandı)
-- UPDATE "Invoice" SET "departmentOrgUnitId" = '<Sistem Geliştirme Müdürlüğü OrgUnit id>',
--   "departmentName" = 'Sistem Geliştirme Müdürlüğü' WHERE category = 'SISTEM_GELISTIRME';

-- Adım 3: eski category enum kolonu kaldırıldı
DROP INDEX "Invoice_category_idx";
ALTER TABLE "Invoice" DROP COLUMN "category";
DROP TYPE "InvoiceCategory";
CREATE INDEX "Invoice_departmentOrgUnitId_idx" ON "Invoice"("departmentOrgUnitId");

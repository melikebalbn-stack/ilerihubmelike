CREATE TABLE "InvoiceRevenueSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "totalRevenueEUR" DECIMAL(16,2) NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvoiceRevenueSetting_pkey" PRIMARY KEY ("id")
);

-- Mevcut aylık ciro kaydı (varsa) tekil ciro alanına taşındı, ardından eski tablo kaldırıldı.
INSERT INTO "InvoiceRevenueSetting" (id, "totalRevenueEUR", "updatedById", "updatedAt")
SELECT 'singleton', "revenueEUR", "createdById", now()
FROM "InvoiceMonthlyRevenue"
ORDER BY "updatedAt" DESC
LIMIT 1;

DROP TABLE "InvoiceMonthlyRevenue";

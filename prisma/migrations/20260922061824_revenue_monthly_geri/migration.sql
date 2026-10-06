-- Ciro tek-toplam (InvoiceRevenueSetting) → yeniden AYLIK (InvoiceMonthlyRevenue).
-- InvoiceRevenueSetting yalnız 1 singleton satır (test, 0.00) tutuyordu — veri kaybı yok (onaylı).
DROP TABLE "InvoiceRevenueSetting";

CREATE TABLE "InvoiceMonthlyRevenue" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "revenueEUR" DECIMAL(16,2) NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceMonthlyRevenue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceMonthlyRevenue_month_key" ON "InvoiceMonthlyRevenue"("month");

-- DropTable
DROP TABLE "InvoiceRevenueSetting";

-- CreateTable
CREATE TABLE "InvoiceMonthlyRevenue" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "revenueEUR" DECIMAL(16,2) NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceMonthlyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceMonthlyRevenue_month_key" ON "InvoiceMonthlyRevenue"("month");


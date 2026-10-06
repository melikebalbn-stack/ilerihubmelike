-- CreateEnum
CREATE TYPE "InvoiceCurrency" AS ENUM ('TRY', 'USD', 'EUR');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "companyName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "InvoiceCurrency" NOT NULL DEFAULT 'TRY',
    "exchangeRate" DECIMAL(10,4) NOT NULL,
    "amountTRY" DECIMAL(14,2) NOT NULL,
    "amountEUR" DECIMAL(14,2) NOT NULL,
    "departmentOrgUnitId" TEXT,
    "departmentName" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceMonthlyRevenue" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "revenueTRY" DECIMAL(16,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceMonthlyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TcmbRateCache" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currency" "InvoiceCurrency" NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TcmbRateCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_departmentOrgUnitId_idx" ON "Invoice"("departmentOrgUnitId");

-- CreateIndex
CREATE INDEX "Invoice_companyName_idx" ON "Invoice"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceMonthlyRevenue_month_key" ON "InvoiceMonthlyRevenue"("month");

-- CreateIndex
CREATE UNIQUE INDEX "TcmbRateCache_date_currency_key" ON "TcmbRateCache"("date", "currency");


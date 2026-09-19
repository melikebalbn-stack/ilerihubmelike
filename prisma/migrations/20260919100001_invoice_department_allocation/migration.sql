-- CreateTable
CREATE TABLE "InvoiceDepartmentAllocation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "departmentOrgUnitId" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amountTRY" DECIMAL(14,2) NOT NULL,
    "amountEUR" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDepartmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDepartmentAllocation_invoiceId_idx" ON "InvoiceDepartmentAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceDepartmentAllocation_departmentOrgUnitId_idx" ON "InvoiceDepartmentAllocation"("departmentOrgUnitId");

-- AddForeignKey
ALTER TABLE "InvoiceDepartmentAllocation" ADD CONSTRAINT "InvoiceDepartmentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


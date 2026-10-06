-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "zimmetFormuId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_zimmetFormuId_idx" ON "Ticket"("zimmetFormuId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_zimmetFormuId_fkey" FOREIGN KEY ("zimmetFormuId") REFERENCES "ZimmetFormu"("id") ON DELETE SET NULL ON UPDATE CASCADE;


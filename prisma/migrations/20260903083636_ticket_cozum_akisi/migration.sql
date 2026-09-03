-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "autoCloseAt" TIMESTAMP(3),
ADD COLUMN     "autoClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastObjectionAt" TIMESTAMP(3),
ADD COLUMN     "objectionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolvedByEmail" TEXT,
ADD COLUMN     "resolvedByName" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_autoCloseAt_idx" ON "Ticket"("autoCloseAt");

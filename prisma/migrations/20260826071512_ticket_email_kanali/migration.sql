-- CreateEnum
CREATE TYPE "EmailIngestSonuc" AS ENUM ('TICKET_OLUSTURULDU', 'YORUM_EKLENDI', 'YOKSAYILDI', 'HATA');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "emailConversationId" TEXT,
ADD COLUMN     "emailFrom" TEXT,
ADD COLUMN     "emailMessageId" TEXT;

-- AlterTable
ALTER TABLE "TicketComment" ADD COLUMN     "emailMessageId" TEXT;

-- CreateTable
CREATE TABLE "EmailIngestLog" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sonuc" "EmailIngestSonuc" NOT NULL,
    "ticketId" TEXT,
    "hataMesaji" TEXT,

    CONSTRAINT "EmailIngestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngestLog_messageId_key" ON "EmailIngestLog"("messageId");

-- CreateIndex
CREATE INDEX "EmailIngestLog_conversationId_idx" ON "EmailIngestLog"("conversationId");

-- CreateIndex
CREATE INDEX "EmailIngestLog_processedAt_idx" ON "EmailIngestLog"("processedAt");

-- CreateIndex
CREATE INDEX "EmailIngestLog_sonuc_idx" ON "EmailIngestLog"("sonuc");

-- CreateIndex
CREATE INDEX "Ticket_emailConversationId_idx" ON "Ticket"("emailConversationId");

-- CreateIndex
CREATE INDEX "Ticket_emailMessageId_idx" ON "Ticket"("emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketComment_emailMessageId_key" ON "TicketComment"("emailMessageId");


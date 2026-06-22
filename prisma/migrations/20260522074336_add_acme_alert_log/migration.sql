-- CreateTable
CREATE TABLE "acme_alert_log" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "daysRemaining" INTEGER NOT NULL,
    "certExpiryDate" TIMESTAMP(3) NOT NULL,
    "recipientEmails" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,

    CONSTRAINT "acme_alert_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acme_alert_log_domain_idx" ON "acme_alert_log"("domain");

-- CreateIndex
CREATE INDEX "acme_alert_log_sentAt_idx" ON "acme_alert_log"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "acme_alert_log_unique" ON "acme_alert_log"("domain", "threshold", "certExpiryDate");

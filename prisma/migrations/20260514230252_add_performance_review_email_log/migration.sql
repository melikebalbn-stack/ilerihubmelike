-- CreateTable
CREATE TABLE "performance_review_email_log" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "reviewId" TEXT,
    "eventType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,

    CONSTRAINT "performance_review_email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_review_email_log_cycleId_idx" ON "performance_review_email_log"("cycleId");

-- CreateIndex
CREATE INDEX "performance_review_email_log_sentAt_idx" ON "performance_review_email_log"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "perf_review_email_log_unique" ON "performance_review_email_log"("cycleId", "reviewId", "eventType", "recipientId");

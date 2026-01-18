-- CreateTable
CREATE TABLE "CalibrationNotificationEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationNotificationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationNotificationEmail_email_key" ON "CalibrationNotificationEmail"("email");

-- CreateIndex
CREATE INDEX "CalibrationNotificationEmail_isActive_idx" ON "CalibrationNotificationEmail"("isActive");

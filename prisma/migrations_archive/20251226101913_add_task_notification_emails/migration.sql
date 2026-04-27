-- CreateTable
CREATE TABLE "TaskNotificationEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskNotificationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskNotificationEmail_email_key" ON "TaskNotificationEmail"("email");

-- CreateIndex
CREATE INDEX "TaskNotificationEmail_isActive_idx" ON "TaskNotificationEmail"("isActive");

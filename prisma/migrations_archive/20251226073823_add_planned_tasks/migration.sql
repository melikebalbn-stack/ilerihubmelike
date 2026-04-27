-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY');

-- CreateEnum
CREATE TYPE "TaskEmailType" AS ENUM ('REMINDER', 'OVERDUE', 'COMPLETED');

-- CreateTable
CREATE TABLE "TaskCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceType" "RecurrenceType",
    "recurrenceInterval" INTEGER,
    "reminderDays" INTEGER[],
    "responsiblePerson" TEXT,
    "responsiblePersonEmail" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "attachments" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEmailLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "recipientEmails" TEXT NOT NULL,
    "emailType" "TaskEmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    CONSTRAINT "TaskEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskCategory_name_key" ON "TaskCategory"("name");

-- CreateIndex
CREATE INDEX "TaskCategory_isActive_sortOrder_idx" ON "TaskCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PlannedTask_status_idx" ON "PlannedTask"("status");

-- CreateIndex
CREATE INDEX "PlannedTask_dueDate_idx" ON "PlannedTask"("dueDate");

-- CreateIndex
CREATE INDEX "PlannedTask_categoryId_idx" ON "PlannedTask"("categoryId");

-- CreateIndex
CREATE INDEX "PlannedTask_priority_idx" ON "PlannedTask"("priority");

-- CreateIndex
CREATE INDEX "TaskEmailLog_taskId_idx" ON "TaskEmailLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskEmailLog_sentAt_idx" ON "TaskEmailLog"("sentAt");

-- AddForeignKey
ALTER TABLE "PlannedTask" ADD CONSTRAINT "PlannedTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEmailLog" ADD CONSTRAINT "TaskEmailLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlannedTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

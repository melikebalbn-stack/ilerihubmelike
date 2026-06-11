-- CreateTable
CREATE TABLE "EmploymentPeriod" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "girisTarihi" DATE NOT NULL,
    "cikisTarihi" DATE,
    "exitParty" TEXT,
    "exitCode" TEXT,
    "exitReason" TEXT,
    "exitRootCause" TEXT,
    "exitTurnoverType" TEXT,
    "exitGeneralNote" TEXT,
    "exitRecordedById" TEXT,
    "exitRecordedAt" TIMESTAMP(3),
    "entryRecordedById" TEXT,
    "entryRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmploymentPeriod_personnelId_idx" ON "EmploymentPeriod"("personnelId");

-- AddForeignKey
ALTER TABLE "EmploymentPeriod" ADD CONSTRAINT "EmploymentPeriod_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


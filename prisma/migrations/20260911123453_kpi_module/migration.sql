-- CreateTable
CREATE TABLE "KPIDefinition" (
    "id" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "direction" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIMeasurement" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target" DOUBLE PRECISION,
    "actual" DOUBLE PRECISION,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIYearlyBaseline" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "average" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "KPIYearlyBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIAction" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "reason" TEXT,
    "action" TEXT,
    "responsibleId" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "completionPercent" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KPIDefinition_orgUnitId_name_key" ON "KPIDefinition"("orgUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "KPIMeasurement_kpiId_year_month_key" ON "KPIMeasurement"("kpiId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "KPIYearlyBaseline_kpiId_year_key" ON "KPIYearlyBaseline"("kpiId", "year");

-- AddForeignKey
ALTER TABLE "KPIDefinition" ADD CONSTRAINT "KPIDefinition_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIMeasurement" ADD CONSTRAINT "KPIMeasurement_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KPIDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIMeasurement" ADD CONSTRAINT "KPIMeasurement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIYearlyBaseline" ADD CONSTRAINT "KPIYearlyBaseline_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KPIDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAction" ADD CONSTRAINT "KPIAction_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KPIDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAction" ADD CONSTRAINT "KPIAction_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "OrgEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "workstations" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ifsWorkCenterKod" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_workstations" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_workstations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workstations_kod_key" ON "workstations"("kod");

-- CreateIndex
CREATE INDEX "workstations_ifsWorkCenterKod_idx" ON "workstations"("ifsWorkCenterKod");

-- CreateIndex
CREATE INDEX "workstations_departmentId_idx" ON "workstations"("departmentId");

-- CreateIndex
CREATE INDEX "personnel_workstations_workstationId_idx" ON "personnel_workstations"("workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_workstations_personnelId_workstationId_key" ON "personnel_workstations"("personnelId", "workstationId");

-- AddForeignKey
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_workstations" ADD CONSTRAINT "personnel_workstations_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_workstations" ADD CONSTRAINT "personnel_workstations_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

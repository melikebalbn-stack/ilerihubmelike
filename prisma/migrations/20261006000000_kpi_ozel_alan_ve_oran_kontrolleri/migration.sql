-- AlterTable
ALTER TABLE "KPIDefinition" ADD COLUMN     "oranPayKaynagi" TEXT NOT NULL DEFAULT 'actual';

-- AlterTable
ALTER TABLE "KPIMeasurement" ADD COLUMN     "gerceklesenNA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hedefNA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manuelOran" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "KPIOzelAlan" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIOzelAlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIOzelAlanDegeri" (
    "id" TEXT NOT NULL,
    "alanId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "naMi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIOzelAlanDegeri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KPIOzelAlan_kpiId_key_key" ON "KPIOzelAlan"("kpiId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "KPIOzelAlanDegeri_alanId_year_month_key" ON "KPIOzelAlanDegeri"("alanId", "year", "month");

-- AddForeignKey
ALTER TABLE "KPIOzelAlan" ADD CONSTRAINT "KPIOzelAlan_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KPIDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIOzelAlanDegeri" ADD CONSTRAINT "KPIOzelAlanDegeri_alanId_fkey" FOREIGN KEY ("alanId") REFERENCES "KPIOzelAlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

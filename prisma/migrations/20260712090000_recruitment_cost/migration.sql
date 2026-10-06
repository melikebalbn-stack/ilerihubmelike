-- CreateEnum
CREATE TYPE "RecruitmentCostType" AS ENUM ('SABIT', 'SAATLIK');

-- CreateTable
CREATE TABLE "RecruitmentCostItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecruitmentCostType" NOT NULL DEFAULT 'SABIT',
    "unitRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentCost" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "publicJobApplicationId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "enteredByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentCostItem_name_key" ON "RecruitmentCostItem"("name");

-- CreateIndex
CREATE INDEX "RecruitmentCostItem_isActive_idx" ON "RecruitmentCostItem"("isActive");

-- CreateIndex
CREATE INDEX "RecruitmentCost_itemId_idx" ON "RecruitmentCost"("itemId");

-- CreateIndex
CREATE INDEX "RecruitmentCost_publicJobApplicationId_idx" ON "RecruitmentCost"("publicJobApplicationId");

-- CreateIndex
CREATE INDEX "RecruitmentCost_createdAt_idx" ON "RecruitmentCost"("createdAt");

-- AddForeignKey
ALTER TABLE "RecruitmentCost" ADD CONSTRAINT "RecruitmentCost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RecruitmentCostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCost" ADD CONSTRAINT "RecruitmentCost_publicJobApplicationId_fkey" FOREIGN KEY ("publicJobApplicationId") REFERENCES "PublicJobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

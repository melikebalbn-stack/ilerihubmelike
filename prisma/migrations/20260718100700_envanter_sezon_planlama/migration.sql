-- AlterTable
ALTER TABLE "envanter_sezon_plan" ADD COLUMN     "emniyetPayiOrani" DOUBLE PRECISION,
ADD COLUMN     "planlananAlim" INTEGER,
ADD COLUMN     "turnoverOrani" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "envanter_sezon_parametre" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "turnoverOrani" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emniyetPayiOrani" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "turnoverKaynak" TEXT NOT NULL DEFAULT 'MANUEL',
    "not" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_sezon_parametre_pkey" PRIMARY KEY ("id")
);

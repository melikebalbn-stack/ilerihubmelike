-- CreateEnum
CREATE TYPE "EnvanterBedenTipi" AS ENUM ('YOK', 'UST', 'ALT', 'AYAKKABI', 'ELDIVEN');

-- AlterTable
ALTER TABLE "envanter_urun" ADD COLUMN     "bedenTipi" "EnvanterBedenTipi" NOT NULL DEFAULT 'YOK';

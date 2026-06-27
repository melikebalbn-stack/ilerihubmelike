-- PR-PERF: OvertimePersonnel sayısal performans alanları (additive, nullable).
-- targetProduction/actualProduction (parça-kodu) AYNEN korunur.
-- AlterTable
ALTER TABLE "OvertimePersonnel" ADD COLUMN     "hedefAdet" INTEGER,
ADD COLUMN     "gerceklesenAdet" INTEGER,
ADD COLUMN     "gerceklesenNote" TEXT;

-- AlterTable
ALTER TABLE "QualitySymbol" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: 10 ISO 1101 / ASME Y14.5 standart sembolü system olarak işaretle
UPDATE "QualitySymbol"
   SET "isSystem" = true
 WHERE key IN (
   'position',
   'parallelism',
   'perpendicularity',
   'flatness',
   'circularity',
   'cylindricity',
   'concentricity',
   'symmetry',
   'straightness',
   'angularity'
 );

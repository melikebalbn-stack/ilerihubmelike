-- 1. FK drop
ALTER TABLE "OvertimePersonnel"
  DROP CONSTRAINT IF EXISTS "OvertimePersonnel_userId_fkey";

-- 2. Olası eski unique index (yoksa zarar yok)
DROP INDEX IF EXISTS "OvertimePersonnel_overtimeFormId_userId_key";

-- 3. Kolon drop
ALTER TABLE "OvertimePersonnel" DROP COLUMN IF EXISTS "userId";

-- 4. NOT NULL constraint (tüm kalan kayıtlarda personnelId dolu)
ALTER TABLE "OvertimePersonnel" ALTER COLUMN "personnelId" SET NOT NULL;

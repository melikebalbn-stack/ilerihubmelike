-- FK rule'u SET NULL'dan RESTRICT'e çevir.
-- Önceki migration personnelId'yi NOT NULL yaptı; SET NULL artık tutarsız.
-- RESTRICT: Personnel hard-delete'i mesai kaydı varsa explicit hatayla geri çevirir
-- (bordro audit trail koruması).

ALTER TABLE "OvertimePersonnel"
  DROP CONSTRAINT IF EXISTS "OvertimePersonnel_personnelId_fkey";

ALTER TABLE "OvertimePersonnel"
  ADD CONSTRAINT "OvertimePersonnel_personnelId_fkey"
  FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

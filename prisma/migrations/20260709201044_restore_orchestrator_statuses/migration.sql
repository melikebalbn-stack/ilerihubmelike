-- RESTORE-ORCHESTRATOR (Faz 1): restore-job durum/tip enum değerleri.
-- Postgres ALTER TYPE ADD VALUE — additive, mevcut satırları etkilemez.
-- NOT: --create-only eşdeğeri; UYGULANMADI (ayrı onay ile `prisma migrate deploy`).

-- AlterEnum: BackupStatus (restore yaşam döngüsü)
ALTER TYPE "BackupStatus" ADD VALUE IF NOT EXISTS 'RESTORING';
ALTER TYPE "BackupStatus" ADD VALUE IF NOT EXISTS 'BUILDING';
ALTER TYPE "BackupStatus" ADD VALUE IF NOT EXISTS 'SWAPPING';
ALTER TYPE "BackupStatus" ADD VALUE IF NOT EXISTS 'ROLLED_BACK';

-- AlterEnum: BackupType (restore-job satırı tipi)
ALTER TYPE "BackupType" ADD VALUE IF NOT EXISTS 'RESTORE';

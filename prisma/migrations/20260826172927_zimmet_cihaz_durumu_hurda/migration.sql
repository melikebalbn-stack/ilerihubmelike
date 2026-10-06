-- Enum'a HURDA değeri ekle. ALTER TYPE ... ADD VALUE bir transaction bloğunda
-- çalışamaz → bu migration AYRI tutuldu (prisma migrate deploy tek başına koşar;
-- elle uygularken --single-transaction KULLANMA).
ALTER TYPE "ZimmetCihazDurumu" ADD VALUE IF NOT EXISTS 'HURDA';

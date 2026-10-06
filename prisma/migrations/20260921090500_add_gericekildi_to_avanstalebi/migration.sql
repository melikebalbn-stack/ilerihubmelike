-- AvansTalebi soft delete: geri-cek/route.ts artik fiziksel silme yerine
-- bu uc alani set ediyor (kim/ne zaman geri cekti kalici olarak tutulur).

-- AlterTable
ALTER TABLE "AvansTalebi" ADD COLUMN     "geriCekildiMi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AvansTalebi" ADD COLUMN     "geriCekenId" TEXT;
ALTER TABLE "AvansTalebi" ADD COLUMN     "geriCekmeTarihi" TIMESTAMP(3);

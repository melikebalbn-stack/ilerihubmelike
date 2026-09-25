-- FİF (KAL-FR-10 Rev 3) FAZ A — eksik form alanları
-- Additive: yeni enum + 3 kolon. Var olan 4 taslak kayıt etkilenmez
-- (yayilimVarMi DEFAULT false ile dolar, diğerleri NULL).

-- CreateEnum
CREATE TYPE "FifAksiyonTuru" AS ENUM ('ACIL', 'KALICI');

-- AlterTable: kapanış değerlendirmesi — yayılım (aynı/benzer uygunsuzluk
-- başka proses/hat/üründe de var mı) Rev 3 son sayfa.
ALTER TABLE "Fif" ADD COLUMN     "yayilimAciklama" TEXT,
ADD COLUMN     "yayilimVarMi" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: faaliyet satırı bazında aksiyon türü (ACİL / KALICI).
ALTER TABLE "FifFaaliyet" ADD COLUMN     "aksiyonTuru" "FifAksiyonTuru";

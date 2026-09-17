-- AvansTalebi.kendiFormuMu: kaydın kendi/route.ts (kendim formu) üzerinden
-- mi yoksa sorumlu formu (route.ts) üzerinden mi girildiğini OLGU olarak
-- saklar. Personnel'in güncel sorumluluk durumundan çıkarımla değil, kayıt
-- anında yazılır — bir sorumlu görevden alındığında geçmiş kayıtların
-- anlamı sessizce değişmesin diye (vekaletenMi ile aynı gerekçe).

-- AlterTable
ALTER TABLE "AvansTalebi" ADD COLUMN     "kendiFormuMu" BOOLEAN NOT NULL DEFAULT false;

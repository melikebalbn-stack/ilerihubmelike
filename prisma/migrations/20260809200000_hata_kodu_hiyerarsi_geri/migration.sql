-- KAL-KYT-15 Bölüm 1: hata kodu hiyerarşisi GERİ ALINIYOR.
--
-- `20260809180000_hata_kodu_duz_liste` hiyerarşiyi kaldırmıştı; bu istenmedi —
-- istenen yalnız satır içi "Alt kod ekle" kısayolunun kaldırılmasıydı.
-- Bu migration ustKodId kolonunu, self-FK'yi ve index'i geri ekler.
--
-- ⚠ VERİ: kolon düşürüldüğünde hiyerarşi verisi de gitti. Bu migration kolonu
--   BOŞ (NULL) olarak geri getirir. Bağları yeniden kurmak için migration'dan
--   SONRA `prisma/data/hata-kodu-hiyerarsi-geri.sql` çalıştırılmalı.
--   O dosya çalıştırılmadan ağaç ekranında 126 kodun tamamı kök seviyede görünür.
--
-- ÜRETİM YÖNTEMİ: `migrate diff --from-schema <origin/main şeması> --to-schema <yeni şema>`.
-- Hiçbir DB'ye bağlanılmadı; çıktı birebir aşağıdaki üç ifade.

-- AlterTable
ALTER TABLE "HataKodu" ADD COLUMN     "ustKodId" TEXT;

-- CreateIndex
CREATE INDEX "HataKodu_ustKodId_idx" ON "HataKodu"("ustKodId");

-- AddForeignKey
ALTER TABLE "HataKodu" ADD CONSTRAINT "HataKodu_ustKodId_fkey" FOREIGN KEY ("ustKodId") REFERENCES "HataKodu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

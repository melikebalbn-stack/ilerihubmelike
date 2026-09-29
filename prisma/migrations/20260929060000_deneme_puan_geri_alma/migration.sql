-- Deneme değerlendirme: puan geri alma olay tipi
--
-- ADDITIVE: mevcut enum'a YENİ DEĞER eklenir. Mevcut satırlar etkilenmez
-- (olayTipi zaten nullable ve mevcut kayıtlarda ya NULL ya YONLENDIRME).
-- Geri alma: PostgreSQL enum değeri DROP etmez; gerekirse tip yeniden yaratılır.

-- AlterEnum
ALTER TYPE "DenemeLogOlayTipi" ADD VALUE 'PUAN_GERI_ALMA';

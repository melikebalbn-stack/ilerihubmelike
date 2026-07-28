-- Melike #8: bu sebeple duruş BAŞLAYINCA kalite birimine bilgilendirme maili gönderilir.
-- ADDITIVE: yeni kolon, NOT NULL DEFAULT false → mevcut satırlar false alır, DROP yok.
ALTER TABLE "ipro_durus_sebebi" ADD COLUMN     "kaliteBildirim" BOOLEAN NOT NULL DEFAULT false;

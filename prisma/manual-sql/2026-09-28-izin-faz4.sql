-- İZİN Faz 4 — İV kuralları (28.09). Migration 20260928150000_izin_faz4 SONRASI, AYRI transaction'da
-- (yeni enum değeri PZT_CMT migration'la aynı transaction'da kullanılamaz). İdempotent.

-- (1) Sabit süreli izinler Pzt–Cmt (Pazar sayılmaz) + (2) belge zorunlu
UPDATE izin_turu SET "gunSayimi" = 'PZT_CMT', "belgeZorunlu" = true, "updatedAt" = now()
WHERE kod IN ('EVLILIK', 'OLUM', 'EVLAT_EDINME', 'BABALIK')
  AND ("gunSayimi" <> 'PZT_CMT' OR "belgeZorunlu" = false);
-- RAPOR zaten belgeZorunlu=true, ozelNitelikli=true, YALNIZ_IV (Faz 1 seed) — dokunulmaz.

-- (5) Mazeret izni — saatlik, yalnız BEYAZ yaka, dönem başına 54 saat (3240 dk). İV kuralı → kilitli (yasal=true)
INSERT INTO izin_turu (id, kod, ad, yasal, bakiyeli, "sabitGun", "gunSayimi", ucretli, "yarimGunOlur", "onayAkisi",
  "belgeZorunlu", "ozelNitelikli", "pdksEtiketi", kosul, aktif, sira, birim, "yillikKotaDakika", "yakaKisiti", "updatedAt")
VALUES ('izin_turu_mazeret', 'MAZERET', 'Mazeret izni (saatlik)', true, false, NULL, 'IS_GUNU', true, false, 'YONETICI_IV',
  false, false, 'İzinli', NULL, true, 75, 'SAAT', 3240, 'BEYAZ', now())
ON CONFLICT (kod) DO NOTHING;

-- Ayarlar (İV teyidi bekleyen varsayılanlar raporda işaretli)
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt") VALUES
  ('setting_izin_sabit_tatil_sayilir', 'izin_sabit_tatil_sayilir', 'false', 'izin', now()), -- İV TEYİDİ
  ('setting_izin_mazeret_donem',       'izin_mazeret_donem',       'TAKVIM_YILI', 'izin', now()), -- İV TEYİDİ (TAKVIM_YILI | ISE_GIRIS_YILI)
  ('setting_izin_belge_saklama_yil',   'izin_belge_saklama_yil',   '15', 'izin', now())
ON CONFLICT (key) DO NOTHING;

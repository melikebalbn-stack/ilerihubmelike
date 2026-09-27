-- PDKS Faz 4 — varsayılan vardiyalar, molalar ve ayarlar (Melih'in kilitli kararları, 27.09).
--
-- Prod'a ELLE uygulanır (migration SONRASI). ON CONFLICT DO NOTHING — idempotent; İV değerleri gelince
-- /pdks/vardiyalar ekranından düzenlenir (bu dosya tekrar koşsa üzerine YAZMAZ).
--  - Mesai herkes için 07:00–17:00; Cumartesi normal çalışma günü DEĞİL (kodda türetilir).
--  - Toleranslar (BizManager'daki mevcut değerler): beyaz geç 15 / erken 5; mavi geç 5 / erken 0.
--  - Molalar: beyaz 12:00–13:00 yemek (düşülür); herkese 10:00 ve 15:00 15'er dk çay (düşülmez).
--    Mavi yaka yemek saati BÖLÜME göre — İV verisi gelince bölüm bazlı satır eklenecek (şimdilik yok).
--  - Gri yaka: varsayılan vardiya/tolerans için MAVI sayılır (Melih 27.09); kişi bazında atamayla değişir.
INSERT INTO pdks_vardiya (id, kod, ad, "girisSaat", "cikisSaat", "gunDonumSaat", "yakaTipi", "gecToleransDk", "erkenToleransDk", varsayilan, sira, aktif, "updatedAt")
VALUES
  ('pdksv_beyaz_gunduz', 'BEYAZ-GUNDUZ', 'Beyaz Yaka 07:00–17:00', '07:00', '17:00', '04:00', 'BEYAZ', 15, 5, true, 10, true, now()),
  ('pdksv_mavi_gunduz',  'MAVI-GUNDUZ',  'Mavi Yaka 07:00–17:00',  '07:00', '17:00', '04:00', 'MAVI',   5, 0, true, 20, true, now()),
  -- Gece vardiyası (Melih 27.09): 21:00→07:00, gün dönümü 12:00 (07:00 çıkışı önceki vardiya gününe yazılır).
  -- Varsayılan DEĞİL — kişi bazında atanır. Toleranslar mavi yakayla aynı.
  ('pdksv_mavi_gece',    'MAVI-GECE',    'Mavi Yaka Gece 21:00–07:00', '21:00', '07:00', '12:00', 'MAVI', 5, 0, false, 30, true, now())
ON CONFLICT (kod) DO NOTHING;

INSERT INTO pdks_vardiya_mola (id, "vardiyaId", tur, baslangic, bitis, dusulur, "departmentId", aktif, "updatedAt")
VALUES
  ('pdksm_beyaz_yemek', 'pdksv_beyaz_gunduz', 'YEMEK', '12:00', '13:00', true,  NULL, true, now()),
  ('pdksm_beyaz_cay1',  'pdksv_beyaz_gunduz', 'CAY',   '10:00', '10:15', false, NULL, true, now()),
  ('pdksm_beyaz_cay2',  'pdksv_beyaz_gunduz', 'CAY',   '15:00', '15:15', false, NULL, true, now()),
  ('pdksm_mavi_cay1',   'pdksv_mavi_gunduz',  'CAY',   '10:00', '10:15', false, NULL, true, now()),
  ('pdksm_mavi_cay2',   'pdksv_mavi_gunduz',  'CAY',   '15:00', '15:15', false, NULL, true, now()),
  -- MAVI-GECE çay: karar "mavi yakayla aynı" → 10:00 ve 15:00 BİREBİR. DİKKAT: bu saatler 21:00–07:00
  -- penceresinin DIŞINDA — gece çalışanına hiç denk gelmez (düşülmez olduğu için hesaba da etkisi yok).
  -- İV gece çay saatlerini verince /pdks/vardiyalar'dan düzeltilmeli.
  ('pdksm_gece_cay1',   'pdksv_mavi_gece',    'CAY',   '10:00', '10:15', false, NULL, true, now()),
  ('pdksm_gece_cay2',   'pdksv_mavi_gece',    'CAY',   '15:00', '15:15', false, NULL, true, now())
ON CONFLICT (id) DO NOTHING;

-- Geçişlerim ekranı cihaz canlıya geçene kadar KAPALI; YARIM gün (IproTatil tip=YARIM) bitiş saati.
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt") VALUES
  ('setting_pdks_gecislerim_acik', 'pdks_gecislerim_acik', 'false', 'pdks', now()),
  ('setting_pdks_yarim_gun_bitis', 'pdks_yarim_gun_bitis', '13:00', 'pdks', now())
ON CONFLICT (key) DO NOTHING;

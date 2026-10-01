-- İZİN MODÜLÜ Faz 1 — yasal izin türleri (Melih 27.09, kilitli). Migration SONRASI elle uygulanır.
-- ON CONFLICT DO NOTHING — idempotent; İV ekranından (Faz 2) YASAL türler düzenlenemez, şirkete özel türler eklenir.
--  - Sabit süreli türlerde (EVLILIK, OLUM, EVLAT_EDINME, BABALIK) gunSayimi ŞİMDİLİK IS_GUNU — İV'nin
--    "iş günü mü takvim günü mü" cevabıyla ayarla değişecek (plan §8 İV-3). ANALIK 168 TAKVIM_GUNU (24 hafta).
--  - RAPOR: gunSayimi IS_GUNU (bilgi amaçlı; bakiyeden düşmez) — İV'ye sorulacak.
--  - ucretli BİLGİ amaçlı (bordro kararı henüz yok): ANALIK / RAPOR (SGK) ve UCRETSIZ false.
--  - BABALIK kosul: 7578 sayılı Kanun — 01.05.2026 ve sonrası doğumlar.
INSERT INTO izin_turu (id, kod, ad, yasal, bakiyeli, "sabitGun", "gunSayimi", ucretli, "yarimGunOlur", "onayAkisi", "belgeZorunlu", "ozelNitelikli", "pdksEtiketi", kosul, aktif, sira, "updatedAt") VALUES
  ('izint_yillik',       'YILLIK',       'Yıllık izin',          true, true,  NULL, 'IS_GUNU',     true,  true,  'YONETICI_IV', false, false, 'İzinli',  NULL,                          true, 10, now()),
  ('izint_evlilik',      'EVLILIK',      'Evlilik izni',         true, false, 3,    'IS_GUNU',     true,  false, 'YONETICI_IV', false, false, 'İzinli',  NULL,                          true, 20, now()),
  ('izint_olum',         'OLUM',         'Ölüm izni (ana, baba, eş, kardeş, çocuk)', true, false, 3, 'IS_GUNU', true, false, 'YONETICI_IV', false, false, 'İzinli', NULL, true, 30, now()),
  ('izint_evlat_edinme', 'EVLAT_EDINME', 'Evlat edinme izni',    true, false, 3,    'IS_GUNU',     true,  false, 'YONETICI_IV', false, false, 'İzinli',  NULL,                          true, 40, now()),
  ('izint_babalik',      'BABALIK',      'Babalık izni',         true, false, 10,   'IS_GUNU',     true,  false, 'YONETICI_IV', false, false, 'İzinli',  'DOGUM_TARIHI_GTE:2026-05-01', true, 50, now()),
  ('izint_analik',       'ANALIK',       'Analık izni (24 hafta)', true, false, 168, 'TAKVIM_GUNU', false, false, 'YONETICI_IV', false, false, 'İzinli',  NULL,                          true, 60, now()),
  ('izint_rapor',        'RAPOR',        'Rapor',                true, false, NULL, 'IS_GUNU',     false, false, 'YALNIZ_IV',   false, true,  'Raporlu', NULL,                          true, 70, now()),
  ('izint_ucretsiz',     'UCRETSIZ',     'Ücretsiz izin',        true, false, NULL, 'IS_GUNU',     false, true,  'YONETICI_IV', false, false, 'İzinli',  NULL,                          true, 80, now())
ON CONFLICT (kod) DO NOTHING;

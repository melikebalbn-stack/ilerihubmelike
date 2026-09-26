-- PDKS Faz 2: panele gidecek kart no biçimi ayarı.
--
-- Prod'a ELLE uygulanır (prisma migrate dışı). Kod tarafı: src/lib/pdks/kart-no.ts
-- (kartNoBicimiOku). Kayıt yoksa kod zaten 'BIRLESIK' varsayar; bu satır ayarı görünür ve
-- düzenlenebilir kılmak içindir. Geçerli değerler: 'BIRLESIK' (8 hane ham) | 'W26_ONDALIK'
-- (tesis*65536+kart). Tanınmayan değer → kart tanımlama ve import DURUR (fail-closed).
--
-- DİKKAT: biçim DEĞİŞTİRİLİRSE tüm pdks_kart."kartNo" yeniden hesaplanmalı ve kartlar panele
-- yeniden yüklenmeli (ayrı iş — Faz 0 test kartı kanıtından sonra). ON CONFLICT DO NOTHING — idempotent.
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt")
VALUES ('setting_pdks_kart_no_bicimi', 'pdks_kart_no_bicimi', 'BIRLESIK', 'pdks', now())
ON CONFLICT (key) DO NOTHING;

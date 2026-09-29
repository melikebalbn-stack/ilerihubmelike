-- İzin Faz 6 — onay hatırlatmaları: veri. Prod'a ELLE (psql -f, tek transaction), migration 20260929090000_izin_faz6
-- SONRASINDA. İdempotent.

-- Hatırlatma süresi (saat): talep bir kademeye düştükten bu kadar saat sonra o kademeye BİR KEZ mail.
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt")
VALUES ('setting_izin_hatirlatma_saat', 'izin_hatirlatma_saat', '24', 'izin', now())
ON CONFLICT (key) DO NOTHING;

-- CANLIYA GEÇİŞ LİSTESİ (crontab'a şimdi EKLENMEZ; izin_talep_acik=true ile aynı gün), saatte bir, UTC:
--   5 * * * * rokunet curl -s -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:<aktif port>/api/cron/izin-hatirlatma
-- (cron.d'deki diğer izin satırlarının biçimini izle; secret'ı ekrana basma.) Kapalıyken uç no-op döner.

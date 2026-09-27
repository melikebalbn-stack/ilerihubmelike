-- İZİN MODÜLÜ Faz 1: izinler + ayar anahtarı.
--
-- KARAR (Melih 27.09): ilk RBAC seed'indeki izin.* anahtarları SAHİPLENİLİR (yeni ad açılmaz):
--   izin.admin   → İV yönetimi (İV kademesi onayı, sahipsiz talepler, tüm takvim, adına talep, tür/bakiye yönetimi).
--                  MEVCUT rol bağları korunur: hr-yoneticisi + super-admin (prod 27.09: 12 kullanıcı). Yalnız açıklama güncellenir.
--   izin.create / izin.approve → KULLANILMAZ (çalışan ve yönetici kapsamı sunucuda hesaplanır); bağlarına dokunulmaz.
-- YENİ (yalnız super-admin; İV müdürüne ayrıca verilir):
--   izin.rapor.gor    → rapor belgesini açma (özel nitelikli veri)
--   izin.bakiye.admin → açılış import apply, negatife düşürerek onay, defter düzeltmesi
--
-- Prod'a ELLE uygulanır (prisma migrate dışı). Kod tarafı: src/lib/auth/permissions.ts. İdempotent.

UPDATE permission
SET description = 'İzin: İV kademesi onayı, sahipsiz talepler, tüm takvim, adına talep, tür ve bakiye yönetimi'
WHERE key = 'izin.admin';

UPDATE permission SET description = 'İzin talebi oluşturma (KULLANILMIYOR — çalışan kapsamı sunucuda hesaplanır)' WHERE key = 'izin.create';
UPDATE permission SET description = 'İzin onaylama (KULLANILMIYOR — yönetici kapsamı sunucuda sorumlu1-3 ile hesaplanır)' WHERE key = 'izin.approve';

INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES
  ('perm_izin_rapor_gor',    'izin.rapor.gor',    'izin', 'İzin: rapor belgesini açma (özel nitelikli veri — her açılış denetime yazılır)', true, now()),
  ('perm_izin_bakiye_admin', 'izin.bakiye.admin', 'izin', 'İzin: açılış bakiyesi import apply, negatife düşürerek onay, defter düzeltmesi',   true, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('izin.rapor.gor', 'izin.bakiye.admin')
WHERE r.slug = 'super-admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Onay hatırlatması: bekleyen kademeye N saat sonra BİR KEZ (eskalasyon YOK — Melih 27.09). İş Faz 6'da.
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt")
VALUES ('setting_izin_hatirlatma_saat', 'izin_hatirlatma_saat', '24', 'izin', now())
ON CONFLICT (key) DO NOTHING;

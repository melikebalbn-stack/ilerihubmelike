-- QDMS-RBAC: Kalite Yönetim Sistemi (qdms/*) modülü için iki permission ekle ve
-- Kalite Yöneticisi + Super Admin rollerine bağla.
--
-- Önce: qdms/* (9 modül) hiç yetkilendirilmemişti — API'ler yalnız requireSession
-- (oturumlu herkes okur+yazar). Bu migration permission satırlarını yazar; kod
-- tarafı (layout + API guard) canAccessKalite VEYA bu permission'ları kontrol eder.
--
-- Permission tanımı seed-permissions/PERMISSION_KEYS ile hizalı (isSystem=true).
-- ON CONFLICT DO NOTHING — idempotent; mevcut satırlara DOKUNMAZ, sadece ekler.

-- 1) Permission satırları
INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES
  ('perm_qdms_view',   'qdms.view',   'qdms', 'Kalite Yönetim Sistemi görüntüleme (doküman/CAPA/denetim/risk/tedarikçi/eğitim/değişiklik/uygunsuzluk/şikayet)', true, now()),
  ('perm_qdms_manage', 'qdms.manage', 'qdms', 'Kalite Yönetim Sistemi yönetim — oluşturma/düzenleme/doküman onayı', true, now())
ON CONFLICT (key) DO NOTHING;

-- 2) Rol bağlama — Kalite Yöneticisi + Super Admin (her ikisi de view + manage)
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('qdms.view', 'qdms.manage')
WHERE r.slug IN ('super-admin', 'kalite-yoneticisi')
ON CONFLICT (role_id, permission_id) DO NOTHING;

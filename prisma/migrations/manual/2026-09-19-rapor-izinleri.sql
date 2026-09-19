-- Rapor Tasarımcısı (Faz 1): 3 izin + super-admin rol bağı.
--
-- Prod'a ELLE uygulanır (prisma migrate dışı). Kod tarafı: src/lib/auth/permissions.ts
-- (PERMISSION_KEYS / PERMISSION_DESCRIPTIONS). super-admin seed-roles.ts'te 'ALL'
-- aldığı için seed de aynı sonucu üretir; bu dosya seed koşturmadan uygulama içindir.
-- Başka role atama YOK. ON CONFLICT DO NOTHING — idempotent, additive.
--
-- Tablo/kolon adları schema.prisma'dan: permission(id,key,module,description,is_system,created_at),
-- role(slug), role_permission(role_id,permission_id) — PK (role_id, permission_id).

INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES
  ('perm_rapor_view',    'rapor.view',    'rapor', 'Raporları görüntüleme ve çalıştırma',              true, now()),
  ('perm_rapor_tasarla', 'rapor.tasarla', 'rapor', 'Rapor şablonu ve veri seti oluşturma/düzenleme',   true, now()),
  ('perm_rapor_katalog', 'rapor.katalog', 'rapor', 'Veri kataloğunu yönetme (entity ekleme/çıkarma)', true, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('rapor.view', 'rapor.tasarla', 'rapor.katalog')
WHERE r.slug = 'super-admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

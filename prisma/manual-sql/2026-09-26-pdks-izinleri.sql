-- PDKS (Faz 1): 2 izin + super-admin rol bağı + ayar anahtarı.
--
-- Prod'a ELLE uygulanır (prisma migrate dışı; bu klasör migrations/ ALTINDA OLMAMALI — Prisma her alt
-- klasörü migration sayar). Kod tarafı: src/lib/auth/permissions.ts (PERMISSION_KEYS /
-- PERMISSION_DESCRIPTIONS). super-admin seed-roles.ts'te 'ALL' aldığı için seed de aynı sonucu üretir;
-- bu dosya seed koşturmadan uygulama içindir. Başka role atama YOK (İV'ye verilmesi ayrı karar).
-- ON CONFLICT DO NOTHING — idempotent, additive.
--
-- Tablo/kolon adları schema.prisma'dan: permission(id,key,module,description,is_system,created_at),
-- role(slug), role_permission(role_id,permission_id) — PK (role_id, permission_id);
-- "SystemSetting"(id,key,value,category,"updatedAt").

INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES
  ('perm_pdks_view',   'pdks.view',   'pdks', 'PDKS geçiş kayıtları, puantaj ve kart listesini görüntüleme',                  true, now()),
  ('perm_pdks_manage', 'pdks.manage', 'pdks', 'PDKS kart tanımlama, cihaz/kapı/okuyucu yönetimi, içe aktarım ve ay kilidi',  true, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('pdks.view', 'pdks.manage')
WHERE r.slug = 'super-admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- "Okuttu ama geçmedi" (geçiş sensörü teyidi) puantajda zorunlu mu? Faz 1'de yalnız anahtar;
-- mantık Faz 4'te. 'false' = kart okutma tek başına geçiş sayılır.
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt")
VALUES ('setting_pdks_gecis_sensoru_zorunlu', 'pdks_gecis_sensoru_zorunlu', 'false', 'pdks', now())
ON CONFLICT (key) DO NOTHING;

-- PDKS — İV kuralları (28.09). Prod'a ELLE (psql -f, tek transaction). İdempotent. Şema değişikliği YOK.

-- (1) Molalar puantajı ETKİLEMEZ: tüm molalar düşülmez. Motor değişmez; prod'da puantaj satırı yok (0) —
--     yeniden hesap gerekmez.
UPDATE pdks_vardiya_mola SET dusulur = false, "updatedAt" = now() WHERE dusulur = true;

-- (2) Geçiş kayıtları saklama süresi 15 yıl. İmha işi YOK (yalnız ayar; plan dokümanında not).
INSERT INTO "SystemSetting" (id, key, value, category, "updatedAt")
VALUES ('setting_pdks_saklama_yil', 'pdks_saklama_yil', '15', 'pdks', now())
ON CONFLICT (key) DO NOTHING;

-- (3) Kart okutamama — güvenlik personeli: izin + rol. Kullanıcılar rol yönetim ekranından atanır
--     (bu dosya kullanıcı EKLEMEZ). Rol yalnız bu izni taşır.
INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES ('perm_kart_okutamama_guvenlik', 'kart_okutamama.guvenlik', 'kart_okutamama',
        'Kart Okutamama (güvenlik): herhangi bir personel adına kayıt açar (amir → İV onayına gider); yalnız kendi açtıklarını görür',
        true, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role (id, name, slug, description, is_system, is_protected, updated_at)
VALUES ('role_guvenlik', 'Güvenlik', 'guvenlik', 'Güvenlik personeli — yalnız Kart Okutamama kaydı açma', false, false, now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p ON p.key = 'kart_okutamama.guvenlik'
WHERE r.slug = 'guvenlik'
ON CONFLICT (role_id, permission_id) DO NOTHING;

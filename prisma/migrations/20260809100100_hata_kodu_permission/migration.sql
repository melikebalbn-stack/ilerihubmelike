-- KAL-KYT-15: quality.hatakodu.manage yazma izni + rol bağı.
--
-- Kitle rma.manage ile BİREBİR AYNI: super-admin + kalite-yoneticisi
-- (20260808120100_rma_permission okundu; staging'de rma.manage'in bağlı olduğu
--  roller sorgulandı → tam olarak bu ikisi). Okuma izni YOK — oturumu olan herkes okur.
-- ON CONFLICT DO NOTHING — idempotent, additive.

INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES
  ('perm_quality_hatakodu_manage', 'quality.hatakodu.manage', 'quality', 'Kalite hata kodları (KAL-KYT-15) yönetim — oluştur/düzenle/pasifleştir', true, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key = 'quality.hatakodu.manage'
WHERE r.slug IN ('super-admin', 'kalite-yoneticisi')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- RMA-RBAC: rma.manage yazma izni + rol bağı.
-- Kitle qdms.manage ile AYNI: super-admin + kalite-yoneticisi. Okuma izni YOK
-- (oturumu olan herkes okur). ON CONFLICT DO NOTHING — idempotent, additive.

INSERT INTO permission (id, key, module, description, is_system, created_at)
VALUES
  ('perm_rma_manage', 'rma.manage', 'rma', 'RMA/SMA iade formu (KAL-KYT-16) yönetim — oluştur/düzenle/sil', true, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key = 'rma.manage'
WHERE r.slug IN ('super-admin', 'kalite-yoneticisi')
ON CONFLICT (role_id, permission_id) DO NOTHING;

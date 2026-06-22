-- PR-RECRUIT-RBAC: recruitment.* permission'larını sistem rollerine ata.
--
-- recruitment.admin (tam yönetim): super-admin, admin, hr-yoneticisi
-- recruitment.create (pozisyon/talep oluştur): super-admin, admin,
--   hr-yoneticisi, departman-muduru
-- recruitment.candidate.view (aday detay): super-admin, admin, hr-yoneticisi
-- recruitment.view (kendi departmanı): departman-muduru
--
-- ON CONFLICT DO NOTHING — idempotent. PR-SEED-DRIFT pattern: sonraki seed
-- çalıştırmaları bu kayıtları ezmez, Y3c matris UI tek doğruluk kaynağı.

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.module = 'recruitment'
WHERE
  -- super-admin: hepsi (zaten ALL ile alır ama explicit)
  (r.slug = 'super-admin')
  OR
  -- admin: hepsi
  (r.slug = 'admin')
  OR
  -- hr-yoneticisi: admin + create + candidate.view (view department-scope
  -- semantik müdür için, HR zaten admin'den görür)
  (r.slug = 'hr-yoneticisi'
    AND p.key IN ('recruitment.admin', 'recruitment.create', 'recruitment.candidate.view'))
  OR
  -- departman-muduru: kendi departmanı görünür + kendi talebi/pozisyonu açar
  (r.slug = 'departman-muduru'
    AND p.key IN ('recruitment.view', 'recruitment.create'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- PR-RECRUIT-PREP (atomic ek): Gokce Eksioglu hr-yoneticisi slug'ına atanır.
-- Eski isHrDepartment string fallback bu kişiyi kapsıyordu; RBAC adopt
-- sonrası fallback kalkıyor, regresyonu önlemek için slug ataması burada
-- yapılır. Audit trail manuel — actor: 'system-migration', PR ref:
-- PR-RECRUIT-RBAC.

INSERT INTO user_role (user_id, role_id, source, assigned_at)
SELECT u.id, r.id, 'manual', NOW()
FROM "User" u, role r
WHERE u.email = 'gokce.eksioglu@ilerigroup.com'
  AND r.slug = 'hr-yoneticisi'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO permission_audit_log (id, action, actor_id, target_type, target_id, details, created_at)
SELECT
  gen_random_uuid()::text,
  'USER_ROLE_GRANTED',
  COALESCE(
    (SELECT id FROM "User" WHERE email = 'melih.dilben@ilerigroup.com' LIMIT 1),
    u.id
  ),
  'USER',
  u.id,
  jsonb_build_object(
    'targetUserEmail', u.email,
    'targetUserName', u.name,
    'roleSlug', 'hr-yoneticisi',
    'roleName', 'HR Yöneticisi',
    'reason', 'PR-RECRUIT-RBAC pre-step: isHrDepartment string fallback kalktı, slug atandı'
  ),
  NOW()
FROM "User" u
WHERE u.email = 'gokce.eksioglu@ilerigroup.com'
  AND EXISTS (
    SELECT 1 FROM user_role ur
    JOIN role r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND r.slug = 'hr-yoneticisi'
  )
ON CONFLICT DO NOTHING;

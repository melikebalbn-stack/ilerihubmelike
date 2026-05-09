-- PR-FORMS-RBAC: forms.admin + forms.approve permission'larını sistem
-- rollerine ata. Permission kayıtları seed-permissions ile yazıldı (idempotent).
--
-- forms.admin (list-all + detail/edit/delete others):
--   Eski MANAGEMENT_ROLES enum (7 üye) → mevcut RBAC slug'ları (6 rol):
--     SUPER_ADMIN     → super-admin
--     ADMIN           → admin
--     HR_MANAGER      → hr-yoneticisi
--     QUALITY_MANAGER → kalite-yoneticisi
--     IT_MANAGER      → it-admin
--     DEPT_HEAD       → departman-muduru
--     SUPERVISOR      → departman-muduru  (Y10 duyuru migration eşleme)
--
-- forms.approve (onay yetkisi, eski ['ADMIN','SUPER_ADMIN','DEPT_HEAD','SUPERVISOR']):
--     super-admin, admin, departman-muduru
--
-- ON CONFLICT DO NOTHING — idempotent, tekrar uygulanırsa noop.
-- Y3c matris UI'ndaki sonraki değişiklikler (revoke/grant) seed tarafından
-- ezilmez (PR-SEED-DRIFT pattern).

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('forms.admin', 'forms.approve')
WHERE
  (r.slug IN ('super-admin', 'admin', 'hr-yoneticisi', 'kalite-yoneticisi', 'it-admin', 'departman-muduru')
    AND p.key = 'forms.admin')
  OR
  (r.slug IN ('super-admin', 'admin', 'departman-muduru')
    AND p.key = 'forms.approve')
ON CONFLICT (role_id, permission_id) DO NOTHING;

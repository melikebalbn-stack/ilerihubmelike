-- PR-DUYURU-TARGETROLES: Announcement.targetRoles içindeki UserRoleEnum
-- string'lerini Role.slug formatına çevir.
--
-- Idempotent: ELSE role_value sayesinde zaten slug formatında olan
-- kayıtlar dokunulmaz, tekrar çalıştırılması zarar vermez.
--
-- Mapping (Y3 seed'le tutarlı):
--   SUPER_ADMIN     → super-admin
--   ADMIN           → admin
--   HR_MANAGER      → hr-yoneticisi
--   IT_MANAGER      → it-admin
--   QUALITY_MANAGER → kalite-yoneticisi
--   DEPT_HEAD       → departman-muduru
--   SUPERVISOR      → departman-muduru   (Y3 seed'de SUPERVISOR slug yok;
--                                         müdür yardımcısı/asistan
--                                         pratiği departman seviyesi)
--   EMPLOYEE        → kullanici

UPDATE "Announcement"
SET "targetRoles" = ARRAY(
  SELECT CASE role_value
    WHEN 'SUPER_ADMIN'     THEN 'super-admin'
    WHEN 'ADMIN'           THEN 'admin'
    WHEN 'HR_MANAGER'      THEN 'hr-yoneticisi'
    WHEN 'IT_MANAGER'      THEN 'it-admin'
    WHEN 'QUALITY_MANAGER' THEN 'kalite-yoneticisi'
    WHEN 'DEPT_HEAD'       THEN 'departman-muduru'
    WHEN 'SUPERVISOR'      THEN 'departman-muduru'
    WHEN 'EMPLOYEE'        THEN 'kullanici'
    ELSE role_value
  END
  FROM unnest("targetRoles") AS role_value
)
WHERE array_length("targetRoles", 1) > 0;

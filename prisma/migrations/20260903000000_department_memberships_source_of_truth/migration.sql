-- Department role memberships are the canonical source for organizational access.
-- Admin and director are global roles (department_id IS NULL). Manager,
-- supervisor, and staff are departmental roles (department_id IS NOT NULL).
--
-- Preserve the complete legacy role state before reconciliation. Unmapped rows
-- are also recorded separately so operators can assign those users from
-- Administration -> Departments after deployment.

CREATE TABLE user_roles_pre_membership_migration AS
SELECT ur.*, NOW() AS archived_at
  FROM user_roles ur;

-- Existing departments predate supervisor assignment support.
INSERT INTO department_roles (department_id, role, name, created_at, updated_at)
SELECT d.id, 'supervisor', d.name || ' supervisor', NOW(), NOW()
  FROM departments d
 WHERE NOT EXISTS (
   SELECT 1
     FROM department_roles existing
    WHERE existing.department_id = d.id
      AND existing.role::text = 'supervisor'
 );

-- Admin and director are always represented by global department-role rows.
INSERT INTO department_roles (department_id, role, name, created_at, updated_at)
SELECT NULL, required_role.role_value::app_role,
       'Global ' || required_role.role_value,
       NOW(), NOW()
  FROM (VALUES ('admin'), ('director')) AS required_role(role_value)
 WHERE NOT EXISTS (
   SELECT 1
     FROM department_roles existing
    WHERE existing.department_id IS NULL
      AND existing.role::text = required_role.role_value
 );

-- Backfill departmental legacy roles when a legacy profile department exists.
INSERT INTO department_role_memberships (id, department_role_id, user_id, created_at, updated_at)
SELECT gen_random_uuid()::text, dr.id, p.user_id, NOW(), NOW()
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.user_id
  JOIN department_roles dr
    ON dr.department_id = p.department_id
   AND dr.role = ur.role
 WHERE p.department_id IS NOT NULL
   AND ur.role::text IN ('staff', 'manager', 'supervisor')
ON CONFLICT (department_role_id, user_id) DO NOTHING;

-- Backfill global roles from legacy role grants.
INSERT INTO department_role_memberships (id, department_role_id, user_id, created_at, updated_at)
SELECT gen_random_uuid()::text, global_role.id, ur.user_id, NOW(), NOW()
  FROM user_roles ur
  JOIN department_roles global_role
    ON global_role.department_id IS NULL
   AND global_role.role = ur.role
 WHERE ur.role::text IN ('admin', 'director')
ON CONFLICT (department_role_id, user_id) DO NOTHING;

-- Promote any pre-existing department-scoped admin/director membership to its
-- canonical global role before removing invalidly scoped memberships.
INSERT INTO department_role_memberships (id, department_role_id, user_id, created_at, updated_at)
SELECT gen_random_uuid()::text, global_role.id, scoped_membership.user_id, NOW(), NOW()
  FROM department_role_memberships scoped_membership
  JOIN department_roles scoped_role
    ON scoped_role.id = scoped_membership.department_role_id
   AND scoped_role.department_id IS NOT NULL
   AND scoped_role.role::text IN ('admin', 'director')
  JOIN department_roles global_role
    ON global_role.department_id IS NULL
   AND global_role.role = scoped_role.role
ON CONFLICT (department_role_id, user_id) DO NOTHING;

-- Enforce role scope on existing memberships. The full legacy effective-role
-- state remains available in user_roles_pre_membership_migration.
DELETE FROM department_role_memberships drm
 USING department_roles dr
 WHERE dr.id = drm.department_role_id
   AND (
     (dr.role::text IN ('admin', 'director') AND dr.department_id IS NOT NULL)
     OR
     (dr.role::text IN ('manager', 'supervisor', 'staff') AND dr.department_id IS NULL)
   );

-- Remove the invalid role definitions after their global admin/director grants
-- have been promoted and their memberships have been removed.
DELETE FROM department_roles dr
 WHERE (dr.role::text IN ('admin', 'director') AND dr.department_id IS NOT NULL)
    OR (dr.role::text IN ('manager', 'supervisor', 'staff') AND dr.department_id IS NULL);

-- Record roles that could not be represented canonically. Typical examples are
-- staff/manager users with no legacy profile department. These rows are not
-- granted access after cutover and require an explicit department assignment.
CREATE TABLE unmapped_user_roles_after_membership_migration AS
SELECT ur.*,
       p.department_id AS legacy_department_id,
       CASE
         WHEN ur.role::text IN ('staff', 'manager', 'supervisor') AND p.department_id IS NULL
           THEN 'departmental role has no legacy profile department'
         ELSE 'no canonical department role membership could be created'
       END AS unmapped_reason,
       NOW() AS recorded_at
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
 WHERE NOT EXISTS (
   SELECT 1
     FROM department_role_memberships drm
     JOIN department_roles dr ON dr.id = drm.department_role_id
    WHERE drm.user_id = ur.user_id
      AND dr.role = ur.role
      AND (
        (dr.role::text IN ('admin', 'director') AND dr.department_id IS NULL)
        OR
        (dr.role::text IN ('manager', 'supervisor', 'staff') AND dr.department_id IS NOT NULL)
      )
 );

-- Rebuild the compatibility table strictly from canonical memberships. Every
-- removed legacy row remains recoverable from user_roles_pre_membership_migration,
-- and unresolved rows are listed in unmapped_user_roles_after_membership_migration.
DELETE FROM user_roles;

INSERT INTO user_roles (id, user_id, role, created_at)
SELECT gen_random_uuid(), drm.user_id, dr.role, NOW()
  FROM department_role_memberships drm
  JOIN department_roles dr ON dr.id = drm.department_role_id
 WHERE (dr.role::text IN ('admin', 'director') AND dr.department_id IS NULL)
    OR (dr.role::text IN ('manager', 'supervisor', 'staff') AND dr.department_id IS NOT NULL)
 GROUP BY drm.user_id, dr.role;

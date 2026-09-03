import type { PoolClient } from "pg";

const SAFE_SQL_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_SQL_REFERENCE = /^(?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_SQL_PARAMETER = /^\$[1-9][0-9]*$/;

export function canonicalRoleScopeSql(alias = "dr"): string {
  if (!SAFE_SQL_ALIAS.test(alias)) {
    throw new Error("Invalid SQL alias for canonical role scope.");
  }

  return `(
    (${alias}.role::text IN ('admin', 'director') AND ${alias}.department_id IS NULL)
    OR
    (${alias}.role::text IN ('manager', 'supervisor', 'staff') AND ${alias}.department_id IS NOT NULL)
  )`;
}

export function managerStaffScopeExistsSql(
  staffUserReference: string,
  managerParameter: string,
): string {
  if (!SAFE_SQL_REFERENCE.test(staffUserReference) || !SAFE_SQL_PARAMETER.test(managerParameter)) {
    throw new Error("Invalid SQL reference for manager/staff scope.");
  }

  return `EXISTS (
    SELECT 1
      FROM department_role_memberships staff_membership
      JOIN department_roles staff_role ON staff_role.id = staff_membership.department_role_id
      JOIN department_role_memberships manager_membership ON manager_membership.user_id = ${managerParameter}
      JOIN department_roles manager_role ON manager_role.id = manager_membership.department_role_id
     WHERE staff_membership.user_id = ${staffUserReference}
       AND staff_role.role::text = 'staff'
       AND manager_role.role::text = 'manager'
       AND staff_role.department_id = manager_role.department_id
  )`;
}

export function isCanonicalRoleAssignment(role: string, departmentId: string | null): boolean {
  return (["admin", "director"].includes(role) && departmentId === null)
    || (["manager", "supervisor", "staff"].includes(role) && departmentId !== null);
}

export async function rebuildUserRoleProjection(
  client: PoolClient,
  userIds: string[],
): Promise<void> {
  const affectedUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (affectedUserIds.length === 0) return;

  const roleTypeResult = await client.query<{ roleType: string }>(
    `SELECT format_type(a.atttypid, a.atttypmod) AS "roleType"
       FROM pg_attribute a
      WHERE a.attrelid = 'user_roles'::regclass
        AND a.attname = 'role'
        AND NOT a.attisdropped`,
  );
  const roleType = roleTypeResult.rows[0]?.roleType;
  if (!roleType) throw new Error("Unable to determine user role type.");

  await client.query(
    `DELETE FROM user_roles WHERE user_id::text = ANY($1::text[])`,
    [affectedUserIds],
  );
  await client.query(
    `INSERT INTO user_roles (id, user_id, role, created_at)
     SELECT gen_random_uuid(), drm.user_id, dr.role::${roleType}, NOW()
       FROM department_role_memberships drm
       JOIN department_roles dr ON dr.id = drm.department_role_id
      WHERE drm.user_id::text = ANY($1::text[])
        AND ${canonicalRoleScopeSql("dr")}
      GROUP BY drm.user_id, dr.role
     ON CONFLICT (user_id, role) DO NOTHING`,
    [affectedUserIds],
  );
}

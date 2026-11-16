import {
  listCentralEntitlements,
  lookupCentralEntitlement,
  rolesFromCentralEntitlement,
  rolesWithinLocalDepartmentScope,
  type ProofPointRole,
} from "@/lib/central-access";
import { query, queryOne } from "@/lib/db";
import { isHubAuthEnabled } from "@/lib/hub-session";
import { canonicalRoleScopeSql } from "@/lib/organization-access";

export type EffectiveUser = {
  id: string;
  email: string;
  fullName: string | null;
  roles: ProofPointRole[];
};

type LocalAccessRow = {
  id: string;
  email: string;
  fullName: string | null;
  centralPersonId: string | null;
  membershipRoles: string[] | null;
};

const localAccessSelect = `
  SELECT u.id,
         u.email,
         u.central_person_id AS "centralPersonId",
         p.full_name AS "fullName",
         COALESCE(
           ARRAY_AGG(DISTINCT dr.role::text) FILTER (WHERE dr.role IS NOT NULL),
           ARRAY[]::text[]
         ) AS "membershipRoles"
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN department_role_memberships drm ON drm.user_id = u.id
    LEFT JOIN department_roles dr
      ON dr.id = drm.department_role_id
     AND ${canonicalRoleScopeSql("dr")}
`;

async function localAccessForUser(userId: string): Promise<LocalAccessRow | null> {
  return queryOne<LocalAccessRow>(
    `${localAccessSelect}
     WHERE u.id = $1 AND u.status = 'active'
     GROUP BY u.id, p.full_name`,
    [userId],
  );
}

export async function effectiveRolesForLocalUser(userId: string): Promise<ProofPointRole[]> {
  const user = await localAccessForUser(userId);
  if (!user) return [];

  if (!isHubAuthEnabled()) {
    return (user.membershipRoles ?? []) as ProofPointRole[];
  }
  if (!user.centralPersonId) return [];

  const entitlement = await lookupCentralEntitlement(user.centralPersonId);
  if (!entitlement) return [];
  return rolesWithinLocalDepartmentScope(
    rolesFromCentralEntitlement(entitlement.role, entitlement.permissions),
    user.membershipRoles ?? [],
  );
}

export async function userHasEffectiveRole(
  userId: string,
  role: ProofPointRole,
): Promise<boolean> {
  return (await effectiveRolesForLocalUser(userId)).includes(role);
}

export async function findLocalUsersWithEffectiveRoles(
  requestedRoles: readonly ProofPointRole[],
): Promise<EffectiveUser[]> {
  const wanted = new Set(requestedRoles);

  if (!isHubAuthEnabled()) {
    const users = await query<LocalAccessRow>(
      `${localAccessSelect}
       WHERE u.status = 'active'
       GROUP BY u.id, p.full_name
       ORDER BY u.email`,
    );
    return users
      .map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: (user.membershipRoles ?? []) as ProofPointRole[],
      }))
      .filter((user) => user.roles.some((role) => wanted.has(role)));
  }

  const directory = await listCentralEntitlements();
  const entitlementByPerson = new Map(directory.map((entry) => [entry.person_id, entry]));
  const personIds = [...entitlementByPerson.keys()];
  if (personIds.length === 0) return [];

  const users = await query<LocalAccessRow>(
    `${localAccessSelect}
     WHERE u.status = 'active'
       AND u.central_person_id = ANY($1::text[])
     GROUP BY u.id, p.full_name
     ORDER BY u.email`,
    [personIds],
  );

  return users.flatMap((user) => {
    if (!user.centralPersonId) return [];
    const entitlement = entitlementByPerson.get(user.centralPersonId);
    if (!entitlement) return [];
    const roles = rolesWithinLocalDepartmentScope(
      rolesFromCentralEntitlement(entitlement.role, entitlement.permissions),
      user.membershipRoles ?? [],
    );
    if (!roles.some((role) => wanted.has(role))) return [];
    return [{ id: user.id, email: user.email, fullName: user.fullName, roles }];
  });
}

export async function findFirstLocalUserWithEffectiveRole(
  role: ProofPointRole,
): Promise<EffectiveUser | null> {
  return (await findLocalUsersWithEffectiveRoles([role]))[0] ?? null;
}

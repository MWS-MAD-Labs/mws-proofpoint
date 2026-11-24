import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import {
  rolesFromCentralEntitlement,
  type CentralDirectoryEmployee,
  type CentralDirectoryEntitlement,
  type CentralOrganizationUnit,
  type CentralUnitAssignment,
  type CentralUnitAssignmentSet,
  type ProofPointRole,
} from "@/lib/central-access";

// Departments and department memberships taken from Central. A department mirrors
// a Central unit. Manager and supervisor memberships come from Central's explicit
// unit assignments. The entitlement scope remains as a compatibility fallback,
// and staff without an explicit assignment follows the person's own unit.
// Departments are never deleted, and accounts not linked to Central are left alone.

const LEGACY_UNIT_NAME = "unknown / legacy";
const LEGACY_SCOPED_LEADERSHIP_ROLES = ["manager", "supervisor"] as const;
const DEPARTMENTAL_ROLES = new Set(["manager", "supervisor", "staff"]);
// A plan that would drop more than this share of the memberships it manages is not applied.
const MAX_REMOVAL_SHARE = 0.5;

export type StructureUnit = { id: string; name: string };

export type StructurePerson = {
  personId: string;
  unitId: string | null;
  roles: ProofPointRole[];
  scopeUnitIds: string[];
  unitAssignments: { unitId: string; role: string }[];
};

export type StructureManagedAssignment = { unitId: string; role: string };

export type StructureLocal = {
  departments: { id: string; name: string; centralUnitId: string | null }[];
  departmentRoles: { id: string; departmentId: string; role: string }[];
  memberships: { userId: string; departmentRoleId: string }[];
  users: { id: string; email: string; centralPersonId: string | null; profileDepartmentId: string | null }[];
};

export type StructureMembershipAdd = { userId: string; email: string; unitId: string; unitName: string; role: string };
export type StructureMembershipRemove = {
  userId: string;
  email: string;
  departmentRoleId: string;
  departmentName: string;
  role: string;
  explicitlyManaged: boolean;
};

export type StructurePlan = {
  links: { departmentId: string; unitId: string; name: string }[];
  renames: { departmentId: string; from: string; to: string }[];
  creates: StructureUnit[];
  adds: StructureMembershipAdd[];
  removes: StructureMembershipRemove[];
  profileUnits: { userId: string; unitId: string }[];
  // Memberships of linked accounts before the plan, to judge how much it removes.
  managedCount: number;
  warnings: string[];
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

// Units and people as Central has them. The directory includes empty units; the
// employee list supplies each person's own unit.
export function centralStructureInput(
  entitlements: readonly CentralDirectoryEntitlement[],
  employees: readonly CentralDirectoryEmployee[],
  directoryUnits?: readonly CentralOrganizationUnit[],
  assignments: readonly CentralUnitAssignment[] = [],
  managedAssignmentSets: readonly CentralUnitAssignmentSet[] = [],
): { units: StructureUnit[]; people: StructurePerson[]; managedAssignments: StructureManagedAssignment[] } {
  const units = new Map<string, StructureUnit>();
  const unitByPerson = new Map<string, string>();
  for (const unit of directoryUnits ?? []) {
    const id = unit.id.trim();
    const name = unit.name.trim();
    if (!id || !name || normalize(name) === LEGACY_UNIT_NAME) continue;
    units.set(id, { id, name });
  }
  for (const employee of employees) {
    const id = employee.unit_id?.trim();
    const name = employee.unit?.trim();
    if (!id || !name || normalize(name) === LEGACY_UNIT_NAME) continue;
    if (directoryUnits === undefined) units.set(id, { id, name });
    unitByPerson.set(employee.person_id, id);
  }
  const roleOfPermission = new Map([
    ["proofpoint.manager", "manager"],
    ["proofpoint.supervisor", "supervisor"],
    ["proofpoint.staff", "staff"],
  ]);
  const people = entitlements.map((entitlement) => ({
    personId: entitlement.person_id,
    unitId: unitByPerson.get(entitlement.person_id) ?? null,
    roles: rolesFromCentralEntitlement(entitlement.role, entitlement.permissions),
    scopeUnitIds: entitlement.scope_unit_ids ?? [],
    unitAssignments: assignments
      .filter((assignment) => assignment.person_id === entitlement.person_id)
      .flatMap((assignment) => {
        const role = roleOfPermission.get(assignment.permission_key);
        return role ? [{ unitId: assignment.unit_id, role }] : [];
      }),
  }));
  const managedAssignments = managedAssignmentSets.flatMap((assignment) => {
    const role = roleOfPermission.get(assignment.permission_key);
    return role ? [{ unitId: assignment.unit_id, role }] : [];
  });
  return { units: [...units.values()], people, managedAssignments };
}

export function planCentralStructure(
  units: readonly StructureUnit[],
  people: readonly StructurePerson[],
  local: StructureLocal,
  managedAssignments: readonly StructureManagedAssignment[] = [],
): StructurePlan {
  const warnings: string[] = [];
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  // Departments.
  const links: StructurePlan["links"] = [];
  const renames: StructurePlan["renames"] = [];
  const creates: StructureUnit[] = [];
  const departmentByUnit = new Map(
    local.departments.filter((d) => d.centralUnitId).map((d) => [d.centralUnitId as string, d]),
  );
  const unlinkedByName = new Map<string, (typeof local.departments)[number][]>();
  for (const department of local.departments) {
    if (department.centralUnitId) continue;
    const key = normalize(department.name);
    unlinkedByName.set(key, [...(unlinkedByName.get(key) ?? []), department]);
  }
  // Central unit id -> local department id, or null while the department is still to be created.
  const unitDepartment = new Map<string, string | null>();
  const departmentUnit = new Map<string, string>();
  for (const unit of units) {
    const linked = departmentByUnit.get(unit.id);
    if (linked) {
      if (linked.name !== unit.name) renames.push({ departmentId: linked.id, from: linked.name, to: unit.name });
      unitDepartment.set(unit.id, linked.id);
      departmentUnit.set(linked.id, unit.id);
      continue;
    }
    const sameName = unlinkedByName.get(normalize(unit.name)) ?? [];
    if (sameName.length > 1) {
      warnings.push(`More than one department is called ${unit.name}; none was linked to the Central unit`);
      continue;
    }
    if (sameName.length === 1) {
      links.push({ departmentId: sameName[0].id, unitId: unit.id, name: unit.name });
      unitDepartment.set(unit.id, sameName[0].id);
      departmentUnit.set(sameName[0].id, unit.id);
      continue;
    }
    creates.push(unit);
    unitDepartment.set(unit.id, null);
  }
  for (const department of local.departments) {
    if (department.centralUnitId && !unitById.has(department.centralUnitId)) {
      warnings.push(`Department ${department.name} points to a Central unit that is no longer listed; it is kept`);
    } else if (!departmentUnit.has(department.id) && !department.centralUnitId) {
      warnings.push(`Department ${department.name} has no Central unit; it is kept, and Central does not fill it`);
    }
  }

  // Memberships.
  const departmentName = new Map(local.departments.map((d) => [d.id, d.name]));
  const roleById = new Map(local.departmentRoles.map((r) => [r.id, r]));
  const membershipsByUser = new Map<string, string[]>();
  for (const membership of local.memberships) {
    const role = roleById.get(membership.departmentRoleId);
    if (!role || !DEPARTMENTAL_ROLES.has(role.role)) continue;
    membershipsByUser.set(membership.userId, [...(membershipsByUser.get(membership.userId) ?? []), membership.departmentRoleId]);
  }
  const personById = new Map(people.map((person) => [person.personId, person]));
  const managedUnitRoles = new Set(managedAssignments.map((item) => `${item.unitId}:${item.role}`));
  for (const person of people) {
    for (const assignment of person.unitAssignments) {
      managedUnitRoles.add(`${assignment.unitId}:${assignment.role}`);
    }
  }

  const adds: StructureMembershipAdd[] = [];
  const removes: StructureMembershipRemove[] = [];
  const profileUnits: StructurePlan["profileUnits"] = [];
  let managedCount = 0;
  let unlinkedWithMemberships = 0;

  for (const user of local.users) {
    const current = membershipsByUser.get(user.id) ?? [];
    if (!user.centralPersonId) {
      if (current.length) unlinkedWithMemberships += 1;
      continue;
    }
    const person = personById.get(user.centralPersonId);
    const roles = person?.roles ?? [];
    const hasAccess = Boolean(person);
    if (hasAccess && person && !person.unitId && person.unitAssignments.length === 0) {
      warnings.push(`${user.email} has no unit in Central; their departments are left as they are`);
      continue;
    }
    managedCount += current.length;

    // unit id -> roles the person should hold there.
    const wanted = new Map<string, Set<string>>();
    const want = (unitId: string, role: string) => {
      if (!unitById.has(unitId)) {
        warnings.push(`${user.email}: Central unit ${unitId} is not in the organization unit directory; skipped`);
        return;
      }
      wanted.set(unitId, (wanted.get(unitId) ?? new Set()).add(role));
    };
    if (hasAccess && person) {
      for (const assignment of person.unitAssignments) want(assignment.unitId, assignment.role);
      // Compatibility for Central deployments that still express department
      // leadership through entitlement permissions and scope_unit_ids.
      for (const role of LEGACY_SCOPED_LEADERSHIP_ROLES) {
        if (!roles.includes(role)) continue;
        if (!person.unitId) continue;
        const scope = person.scopeUnitIds.length ? person.scopeUnitIds : [person.unitId];
        for (const unitId of scope) {
          if (!managedUnitRoles.has(`${unitId}:${role}`)) want(unitId, role);
        }
      }
      if (person.unitId) {
        // Application role and department membership are independent. Every
        // covered employee belongs to their home unit as staff unless Central
        // explicitly makes them a manager or supervisor of that same unit.
        const homeRoles = wanted.get(person.unitId);
        if (
          !managedUnitRoles.has(`${person.unitId}:staff`) &&
          !homeRoles?.has("manager") &&
          !homeRoles?.has("supervisor")
        ) {
          want(person.unitId, "staff");
        }
        const ownDepartment = unitDepartment.get(person.unitId);
        if (ownDepartment !== undefined && ownDepartment !== user.profileDepartmentId) {
          profileUnits.push({ userId: user.id, unitId: person.unitId });
        }
      }
    }

    for (const departmentRoleId of current) {
      const role = roleById.get(departmentRoleId) as { departmentId: string; role: string };
      const unitId = departmentUnit.get(role.departmentId);
      if (unitId && wanted.get(unitId)?.delete(role.role)) continue;
      removes.push({
        userId: user.id,
        email: user.email,
        departmentRoleId,
        departmentName: departmentName.get(role.departmentId) ?? role.departmentId,
        role: role.role,
        explicitlyManaged: Boolean(unitId && managedUnitRoles.has(`${unitId}:${role.role}`)),
      });
    }
    for (const [unitId, unitRoles] of wanted) {
      for (const role of unitRoles) {
        adds.push({ userId: user.id, email: user.email, unitId, unitName: unitById.get(unitId)?.name ?? unitId, role });
      }
    }
  }
  if (unlinkedWithMemberships) {
    warnings.push(`${unlinkedWithMemberships} account(s) with departments are not linked to Central; their departments are left as they are`);
  }

  return { links, renames, creates, adds, removes, profileUnits, managedCount, warnings };
}

// True when the plan would remove too much at once to apply without a person looking.
export function structurePlanRemovesTooMuch(plan: StructurePlan): boolean {
  return plan.managedCount > 0 && structureGuardedRemovalCount(plan) > plan.managedCount * MAX_REMOVAL_SHARE;
}

export function structureGuardedRemovalCount(plan: StructurePlan): number {
  return plan.removes.filter((item) => !item.explicitlyManaged).length;
}

export function describeStructurePlan(plan: StructurePlan): string[] {
  return [
    ...plan.links.map((item) => `Link department ${item.name} to its Central unit`),
    ...plan.renames.map((item) => `Rename department ${item.from} to ${item.to}`),
    ...plan.creates.map((unit) => `Create department ${unit.name}`),
    ...plan.adds.map((item) => `Add ${item.email} as ${item.role} of ${item.unitName}`),
    ...plan.removes.map((item) => `Remove ${item.email} as ${item.role} of ${item.departmentName}`),
  ];
}

export type CentralStructureStore = {
  load(): Promise<StructureLocal>;
  apply(plan: StructurePlan, personIdByUser: Map<string, string>): Promise<void>;
};

async function loadStructure(client: PoolClient): Promise<StructureLocal> {
  const [departments, departmentRoles, memberships, users] = await Promise.all([
    client.query(`SELECT id::text, name, central_unit_id AS "centralUnitId" FROM departments`),
    client.query(
      `SELECT id::text, department_id::text AS "departmentId", role::text AS role
         FROM department_roles WHERE department_id IS NOT NULL`,
    ),
    client.query(
      `SELECT user_id::text AS "userId", department_role_id::text AS "departmentRoleId"
         FROM department_role_memberships`,
    ),
    client.query(
      `SELECT u.id::text, u.email, u.central_person_id AS "centralPersonId",
              p.department_id::text AS "profileDepartmentId"
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.status <> 'deleted'`,
    ),
  ]);
  return {
    departments: departments.rows,
    departmentRoles: departmentRoles.rows,
    memberships: memberships.rows,
    users: users.rows,
  };
}

export const pgStructureStore: CentralStructureStore = {
  async load() {
    const { pool } = await import("@/lib/db");
    const client = await pool.connect();
    try {
      return await loadStructure(client);
    } finally {
      client.release();
    }
  },

  async apply(plan, personIdByUser) {
    const { pool } = await import("@/lib/db");
    const { rebuildUserRoleProjection } = await import("@/lib/organization-access");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const affected = [...new Set([...plan.adds, ...plan.removes].map((item) => item.userId))];
      // Same per-person lock as sign-in, taken in a fixed order.
      const personIds = affected.map((id) => personIdByUser.get(id)).filter(Boolean).sort() as string[];
      for (const personId of personIds) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [personId]);
      }

      for (const link of plan.links) {
        await client.query(
          `UPDATE departments SET central_unit_id = $2, name = $3, updated_at = NOW()
            WHERE id::text = $1 AND central_unit_id IS NULL`,
          [link.departmentId, link.unitId, link.name],
        );
      }
      for (const rename of plan.renames) {
        await client.query(`UPDATE departments SET name = $2, updated_at = NOW() WHERE id::text = $1`, [
          rename.departmentId,
          rename.to,
        ]);
      }
      for (const unit of plan.creates) {
        await client.query(
          `INSERT INTO departments (id, name, central_unit_id, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
           ON CONFLICT (central_unit_id) WHERE central_unit_id IS NOT NULL DO NOTHING`,
          [unit.name, unit.id],
        );
      }

      const linked = await client.query<{ id: string; unitId: string }>(
        `SELECT id::text, central_unit_id AS "unitId" FROM departments WHERE central_unit_id IS NOT NULL`,
      );
      const departmentOfUnit = new Map(linked.rows.map((row) => [row.unitId, row.id]));

      // Keep the role definitions the old ProofPoint department flow created,
      // even before the first person is assigned to a new Central unit.
      for (const departmentId of departmentOfUnit.values()) {
        for (const role of ["manager", "supervisor", "staff"]) {
          await client.query(
            `INSERT INTO department_roles (id, department_id, role, created_at, updated_at)
             SELECT gen_random_uuid(), $1::uuid, $2::public.app_role, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM department_roles
                 WHERE department_id = $1::uuid AND role = $2::public.app_role
              )`,
            [departmentId, role],
          );
        }
      }

      for (const item of plan.removes) {
        await client.query(
          `DELETE FROM department_role_memberships WHERE user_id::text = $1 AND department_role_id::text = $2`,
          [item.userId, item.departmentRoleId],
        );
      }
      for (const item of plan.adds) {
        const departmentId = departmentOfUnit.get(item.unitId);
        if (!departmentId) continue;
        const existing = await client.query<{ id: string }>(
          `SELECT id::text FROM department_roles WHERE department_id::text = $1 AND role::text = $2
            ORDER BY created_at LIMIT 1`,
          [departmentId, item.role],
        );
        const departmentRoleId =
          existing.rows[0]?.id ??
          (
            await client.query<{ id: string }>(
              `INSERT INTO department_roles (id, department_id, role, created_at, updated_at)
               VALUES (gen_random_uuid(), $1::uuid, $2, NOW(), NOW()) RETURNING id::text`,
              [departmentId, item.role],
            )
          ).rows[0].id;
        await client.query(
          `INSERT INTO department_role_memberships (id, department_role_id, user_id, created_at, updated_at)
           VALUES ($1, $2::uuid, $3::uuid, NOW(), NOW())
           ON CONFLICT (department_role_id, user_id) DO NOTHING`,
          [randomUUID(), departmentRoleId, item.userId],
        );
      }
      for (const item of plan.profileUnits) {
        const departmentId = departmentOfUnit.get(item.unitId);
        if (!departmentId) continue;
        await client.query(
          `UPDATE profiles SET department_id = $2::uuid, updated_at = NOW() WHERE user_id::text = $1`,
          [item.userId, departmentId],
        );
      }

      await rebuildUserRoleProjection(client, affected);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

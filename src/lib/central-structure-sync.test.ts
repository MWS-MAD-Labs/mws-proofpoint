import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CentralDirectoryEmployee, CentralDirectoryEntitlement } from "@/lib/central-access";
import {
  centralStructureInput,
  describeStructurePlan,
  planCentralStructure,
  structurePlanRemovesTooMuch,
  type StructureLocal,
  type StructurePerson,
  type StructureUnit,
} from "@/lib/central-structure-sync";

const units: StructureUnit[] = [
  { id: "unit-es", name: "Elementary" },
  { id: "unit-jh", name: "Junior High" },
  { id: "unit-mad", name: "MAD Lab" },
];

function local(overrides: Partial<StructureLocal> = {}): StructureLocal {
  return {
    departments: [
      { id: "d-es", name: "Elementary", centralUnitId: null },
      { id: "d-jh", name: "Junior  high", centralUnitId: null },
      { id: "d-mad", name: "MAD Lab", centralUnitId: "unit-mad" },
      { id: "d-mgmt", name: "Management", centralUnitId: null },
    ],
    departmentRoles: [
      { id: "r-es-staff", departmentId: "d-es", role: "staff" },
      { id: "r-es-manager", departmentId: "d-es", role: "manager" },
      { id: "r-jh-staff", departmentId: "d-jh", role: "staff" },
      { id: "r-mgmt-staff", departmentId: "d-mgmt", role: "staff" },
    ],
    memberships: [],
    users: [],
    ...overrides,
  };
}

const person = (overrides: Partial<StructurePerson> = {}): StructurePerson => ({
  personId: "p-1",
  unitId: "unit-es",
  roles: ["staff"],
  scopeUnitIds: [],
  unitAssignments: [],
  ...overrides,
});

const user = (id: string, centralPersonId: string | null, profileDepartmentId: string | null = null) => ({
  id,
  email: `${id}@millennia21.id`,
  centralPersonId,
  profileDepartmentId,
});

describe("planCentralStructure departments", () => {
  it("links departments by name, renames to Central's name, creates missing units, and keeps the rest", () => {
    const plan = planCentralStructure(
      [...units, { id: "unit-pelangi", name: "Pelangi" }],
      [],
      local(),
    );
    assert.deepEqual(plan.links, [
      { departmentId: "d-es", unitId: "unit-es", name: "Elementary" },
      { departmentId: "d-jh", unitId: "unit-jh", name: "Junior High" },
    ]);
    assert.deepEqual(plan.creates, [{ id: "unit-pelangi", name: "Pelangi" }]);
    assert.deepEqual(plan.renames, []);
    assert.ok(plan.warnings.some((w) => /Management has no Central unit/.test(w)));
  });

  it("follows a renamed Central unit", () => {
    const plan = planCentralStructure([{ id: "unit-mad", name: "MAD Labs" }], [], local());
    assert.deepEqual(plan.renames, [{ departmentId: "d-mad", from: "MAD Lab", to: "MAD Labs" }]);
  });

  it("keeps and reports a department whose linked Central unit was removed", () => {
    const plan = planCentralStructure([], [], local());
    assert.ok(plan.warnings.some((warning) => /MAD Lab points to a Central unit that is no longer listed; it is kept/.test(warning)));
    assert.deepEqual(plan.renames, []);
    assert.deepEqual(plan.creates, []);
  });

  it("refuses to guess between two departments with the same name", () => {
    const plan = planCentralStructure(
      units.slice(0, 1),
      [],
      local({ departments: [{ id: "a", name: "Elementary", centralUnitId: null }, { id: "b", name: "elementary", centralUnitId: null }] }),
    );
    assert.deepEqual(plan.links, []);
    assert.deepEqual(plan.creates, []);
    assert.ok(plan.warnings.some((w) => /More than one department is called Elementary/.test(w)));
  });
});

describe("planCentralStructure memberships", () => {
  it("applies an explicit staff capability to the person's unit and fixes the profile department", () => {
    const plan = planCentralStructure(units, [person()], local({ users: [user("u-1", "p-1")] }));
    assert.deepEqual(plan.adds.map(({ userId, unitId, role }) => ({ userId, unitId, role })), [
      { userId: "u-1", unitId: "unit-es", role: "staff" },
    ]);
    assert.deepEqual(plan.profileUnits, [{ userId: "u-1", unitId: "unit-es" }]);
    assert.deepEqual(plan.removes, []);
  });

  it("gives a manager only the units Central picked, or their own unit when none were picked", () => {
    const picked = planCentralStructure(
      units,
      [person({ roles: ["manager"], scopeUnitIds: ["unit-es", "unit-jh"] })],
      local({ users: [user("u-1", "p-1", "d-es")] }),
    );
    assert.deepEqual(
      picked.adds.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-es:manager", "unit-es:staff", "unit-jh:manager"],
    );

    const own = planCentralStructure(units, [person({ roles: ["manager"] })], local({ users: [user("u-1", "p-1", "d-es")] }));
    assert.deepEqual(
      own.adds.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-es:manager", "unit-es:staff"],
    );
  });

  it("keeps a global admin global while applying its manager capability to selected units", () => {
    const plan = planCentralStructure(
      units,
      [person({ roles: ["admin", "manager"], scopeUnitIds: ["unit-mad"] })],
      local({ users: [user("u-1", "p-1", "d-es")] }),
    );
    assert.deepEqual(
      plan.adds.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-es:staff", "unit-mad:manager"],
    );
    assert.deepEqual(plan.profileUnits, []);
  });

  it("keeps an application admin as staff of their home unit", () => {
    const plan = planCentralStructure(
      units,
      [person({ roles: ["admin"] })],
      local({ users: [user("u-1", "p-1", "d-es")] }),
    );

    assert.deepEqual(plan.adds.map(({ unitId, role }) => `${unitId}:${role}`), ["unit-es:staff"]);
  });

  it("keeps staff membership when an employee also leads their home unit", () => {
    const plan = planCentralStructure(
      units,
      [person({
        roles: ["admin"],
        unitAssignments: [{ unitId: "unit-es", role: "manager" }],
      })],
      local({ users: [user("u-1", "p-1", "d-es")] }),
    );

    assert.deepEqual(
      plan.adds.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-es:manager", "unit-es:staff"],
    );
  });

  it("treats a managed staff list as authoritative, including when it is empty", () => {
    const plan = planCentralStructure(
      units,
      [person({ roles: ["admin"] })],
      local({ users: [user("u-1", "p-1", "d-es")] }),
      [{ unitId: "unit-es", role: "staff" }],
    );

    assert.deepEqual(plan.adds, []);
  });

  it("does not hold an intentional bulk removal from an explicitly managed role list", () => {
    const plan = planCentralStructure(
      units,
      [person({ roles: ["admin"] })],
      local({
        users: [user("u-1", "p-1", "d-es")],
        memberships: [{ userId: "u-1", departmentRoleId: "r-es-staff" }],
      }),
      [{ unitId: "unit-es", role: "staff" }],
    );

    assert.equal(plan.removes[0]?.explicitlyManaged, true);
    assert.equal(structurePlanRemovesTooMuch(plan), false);
  });

  it("assigns a global admin as manager of multiple units without changing the global role", () => {
    const plan = planCentralStructure(
      units,
      [person({
        unitId: null,
        roles: ["admin"],
        unitAssignments: [
          { unitId: "unit-mad", role: "manager" },
          { unitId: "unit-jh", role: "manager" },
        ],
      })],
      local({ users: [user("u-1", "p-1")] }),
    );
    assert.deepEqual(
      plan.adds.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-jh:manager", "unit-mad:manager"],
    );
    assert.deepEqual(plan.profileUnits, []);
    assert.equal(plan.warnings.some((warning) => /has no unit in Central/.test(warning)), false);
  });

  it("keeps memberships that already match and removes the ones Central no longer gives", () => {
    const plan = planCentralStructure(
      units,
      [person({ unitId: "unit-jh" })],
      local({
        users: [user("u-1", "p-1", "d-jh")],
        memberships: [
          { userId: "u-1", departmentRoleId: "r-jh-staff" },
          { userId: "u-1", departmentRoleId: "r-es-manager" },
          { userId: "u-1", departmentRoleId: "r-mgmt-staff" },
        ],
      }),
    );
    assert.deepEqual(plan.adds, []);
    assert.deepEqual(plan.removes.map((item) => `${item.departmentName}:${item.role}`), ["Elementary:manager", "Management:staff"]);
    assert.equal(plan.managedCount, 3);
  });

  it("removes the departments of a linked account that lost access, and leaves unlinked accounts alone", () => {
    const plan = planCentralStructure(
      units,
      [],
      local({
        users: [user("u-gone", "p-gone"), user("u-legacy", null)],
        memberships: [
          { userId: "u-gone", departmentRoleId: "r-es-staff" },
          { userId: "u-legacy", departmentRoleId: "r-es-staff" },
        ],
      }),
    );
    assert.deepEqual(plan.removes.map((item) => item.userId), ["u-gone"]);
    assert.ok(plan.warnings.some((w) => /1 account\(s\) with departments are not linked/.test(w)));
  });

  it("leaves a person with no Central unit as they are", () => {
    const plan = planCentralStructure(
      units,
      [person({ unitId: null })],
      local({ users: [user("u-1", "p-1")], memberships: [{ userId: "u-1", departmentRoleId: "r-es-staff" }] }),
    );
    assert.deepEqual(plan.adds, []);
    assert.deepEqual(plan.removes, []);
    assert.ok(plan.warnings.some((w) => /has no unit in Central/.test(w)));
  });

  it("holds a plan that would remove more than half of what it manages", () => {
    const plan = planCentralStructure(
      units,
      [],
      local({
        users: [user("u-1", "p-1"), user("u-2", "p-2")],
        memberships: [
          { userId: "u-1", departmentRoleId: "r-es-staff" },
          { userId: "u-2", departmentRoleId: "r-es-staff" },
        ],
      }),
    );
    assert.equal(structurePlanRemovesTooMuch(plan), true);
    assert.deepEqual(describeStructurePlan(plan).filter((line) => line.startsWith("Remove")), [
      "Remove u-1@millennia21.id as staff of Elementary",
      "Remove u-2@millennia21.id as staff of Elementary",
    ]);
  });
});

describe("centralStructureInput", () => {
  it("takes units from employees, skips the legacy unit, and reads roles and picked units", () => {
    const { units: found, people } = centralStructureInput(
      [
        { person_id: "p-1", role: "ADMIN_MANAGER", permissions: ["proofpoint.access", "proofpoint.admin", "proofpoint.manager"], scope_unit_ids: ["unit-jh"] },
        { person_id: "p-2", role: "STAFF", permissions: ["proofpoint.access", "proofpoint.staff"] },
      ] as CentralDirectoryEntitlement[],
      [
        { person_id: "p-1", unit_id: "unit-es", unit: "Elementary" },
        { person_id: "p-2", unit_id: "unit-legacy", unit: "Unknown / Legacy" },
        { person_id: "p-3", unit_id: "unit-jh", unit: "Junior High" },
      ] as CentralDirectoryEmployee[],
    );
    assert.deepEqual(found, [{ id: "unit-es", name: "Elementary" }, { id: "unit-jh", name: "Junior High" }]);
    assert.deepEqual(people, [
      { personId: "p-1", unitId: "unit-es", roles: ["admin", "manager"], scopeUnitIds: ["unit-jh"], unitAssignments: [] },
      { personId: "p-2", unitId: null, roles: ["staff"], scopeUnitIds: [], unitAssignments: [] },
    ]);
  });

  it("includes Central units that have no active employees", () => {
    const { units: found } = centralStructureInput(
      [],
      [],
      [
        { id: "unit-es", name: "Elementary" },
        { id: "unit-empty", name: "New Empty Unit" },
      ],
    );
    assert.deepEqual(found, [
      { id: "unit-es", name: "Elementary" },
      { id: "unit-empty", name: "New Empty Unit" },
    ]);
  });

  it("keeps department assignments separate from the entitlement role", () => {
    const { people } = centralStructureInput(
      [{
        person_id: "p-1",
        role: "ADMIN",
        permissions: ["proofpoint.access", "proofpoint.admin"],
      }] as CentralDirectoryEntitlement[],
      [{ person_id: "p-1", unit_id: "unit-es", unit: "Elementary" }] as CentralDirectoryEmployee[],
      units,
      [
        { person_id: "p-1", unit_id: "unit-mad", permission_key: "proofpoint.manager" },
        { person_id: "p-1", unit_id: "unit-jh", permission_key: "proofpoint.manager" },
      ],
    );

    assert.deepEqual(people[0], {
      personId: "p-1",
      unitId: "unit-es",
      roles: ["admin"],
      scopeUnitIds: [],
      unitAssignments: [
        { unitId: "unit-mad", role: "manager" },
        { unitId: "unit-jh", role: "manager" },
      ],
    });
  });

  it("expands a parent Manager assignment to every child Unit", () => {
    const hierarchy = [
      { id: "unit-mad", name: "MAD Lab", parent_unit_id: null },
      { id: "unit-fullstack", name: "Fullstack", parent_unit_id: "unit-mad" },
      { id: "unit-it", name: "IT Support", parent_unit_id: "unit-mad" },
    ];
    const { people, managedAssignments } = centralStructureInput(
      [{ person_id: "p-1", role: "ADMIN", permissions: ["proofpoint.access", "proofpoint.admin"] }] as CentralDirectoryEntitlement[],
      [{ person_id: "p-1", unit_id: "unit-mad", unit: "MAD Lab" }] as CentralDirectoryEmployee[],
      hierarchy,
      [{ person_id: "p-1", unit_id: "unit-mad", permission_key: "proofpoint.manager" }],
      [{ unit_id: "unit-mad", permission_key: "proofpoint.manager" }],
    );

    assert.deepEqual(
      people[0]?.unitAssignments.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-fullstack:manager", "unit-it:manager", "unit-mad:manager"],
    );
    assert.deepEqual(
      managedAssignments.map(({ unitId, role }) => `${unitId}:${role}`).sort(),
      ["unit-fullstack:manager", "unit-it:manager", "unit-mad:manager"],
    );
  });

  it("plans the ProofPoint department hierarchy from Central Units", () => {
    const hierarchyUnits: StructureUnit[] = [
      { id: "unit-mad", name: "MAD Lab", parentUnitId: null },
      { id: "unit-it", name: "IT Support", parentUnitId: "unit-mad" },
    ];
    const plan = planCentralStructure(
      hierarchyUnits,
      [],
      local({
        departments: [
          { id: "d-mad", name: "MAD Lab", centralUnitId: "unit-mad", parentId: null },
          { id: "d-it", name: "IT Support", centralUnitId: "unit-it", parentId: null },
        ],
      }),
    );

    assert.deepEqual(plan.parents, [{ unitId: "unit-it", parentUnitId: "unit-mad" }]);
  });
});

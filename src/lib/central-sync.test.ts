import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { CentralDirectoryEmployee, CentralDirectoryEntitlement } from "@/lib/central-access";
import {
  centralManagesDepartments,
  managedInCentralResponse,
  centralSyncIntervalMs,
  centralSyncPeople,
  getCentralSyncStatus,
  planCentralSync,
  resetCentralSyncStateForTest,
  runCentralSync,
  type CentralSyncAction,
  type CentralSyncDependencies,
  type CentralSyncLocalUser,
  type CentralSyncPerson,
} from "@/lib/central-sync";

function person(overrides: Partial<CentralSyncPerson> = {}): CentralSyncPerson {
  return {
    personId: "person-roma",
    email: "romasta@millennia21.id",
    fullName: "Romasta Oryza Sativa Siagian",
    employeeId: "EMP-001",
    jobTitle: "Principal",
    hasAccess: true,
    ...overrides,
  };
}

function localUser(overrides: Partial<CentralSyncLocalUser> = {}): CentralSyncLocalUser {
  return {
    id: "user-roma",
    email: "roma@millennia21.id",
    centralPersonId: null,
    profile: { email: "roma@millennia21.id", fullName: "Roma", niy: null, jobTitle: null },
    ...overrides,
  };
}

describe("planCentralSync", () => {
  it("refreshes a linked account's email and profile from Central", () => {
    const plan = planCentralSync([person()], [localUser({ centralPersonId: "person-roma" })]);

    assert.deepEqual(plan.warnings, []);
    assert.deepEqual(plan.actions, [{
      kind: "update",
      userId: "user-roma",
      personId: "person-roma",
      link: false,
      changes: {
        email: "romasta@millennia21.id",
        fullName: "Romasta Oryza Sativa Siagian",
        niy: "EMP-001",
        jobTitle: "Principal",
      },
      profileEmail: "romasta@millennia21.id",
    }]);
  });

  it("links an unlinked account by its employee ID when the email differs", () => {
    const plan = planCentralSync(
      [person()],
      [localUser({ profile: { email: "roma@millennia21.id", fullName: "Roma", niy: "emp-001", jobTitle: null } })],
    );

    assert.equal(plan.actions.length, 1);
    const action = plan.actions[0] as Extract<CentralSyncAction, { kind: "update" }>;
    assert.equal(action.link, "employee_id");
    assert.equal(action.changes.email, "romasta@millennia21.id");
  });

  it("links an unlinked account with the same email", () => {
    const plan = planCentralSync([person()], [localUser({ email: "Romasta@millennia21.id" })]);
    const action = plan.actions[0] as Extract<CentralSyncAction, { kind: "update" }>;
    assert.equal(action.link, "email");
    assert.equal(action.changes.email, "romasta@millennia21.id");
  });

  it("creates an account for a person with access who has none yet", () => {
    const plan = planCentralSync([person()], []);
    assert.deepEqual(plan.actions, [{ kind: "create", person: person() }]);
  });

  it("does not create or link people who have no ProofPoint access", () => {
    const plan = planCentralSync([person({ hasAccess: false })], [localUser()]);
    assert.deepEqual(plan.actions, []);
  });

  it("never moves an email onto an account when another account owns it", () => {
    const plan = planCentralSync(
      [person()],
      [
        localUser({ centralPersonId: "person-roma" }),
        localUser({ id: "user-other", email: "romasta@millennia21.id", centralPersonId: null }),
      ],
    );
    const action = plan.actions[0] as Extract<CentralSyncAction, { kind: "update" }>;
    assert.equal(action.changes.email, undefined);
    assert.equal(action.profileEmail, "roma@millennia21.id");
    assert.match(plan.warnings[0], /belongs to another local account/);
  });

  it("leaves an email linked to another Central person untouched", () => {
    const plan = planCentralSync(
      [person()],
      [localUser({ email: "romasta@millennia21.id", centralPersonId: "someone-else" })],
    );
    assert.deepEqual(plan.actions, []);
    assert.match(plan.warnings[0], /already linked to another Central person/);
  });

  it("refuses to guess when several accounts share an employee ID", () => {
    const shared = { email: "x", fullName: null, niy: "EMP-001", jobTitle: null };
    const plan = planCentralSync(
      [person()],
      [
        localUser({ id: "a", email: "a@millennia21.id", profile: shared }),
        localUser({ id: "b", email: "b@millennia21.id", profile: shared }),
      ],
    );
    assert.deepEqual(plan.actions, []);
    assert.match(plan.warnings[0], /more than one local account/);
  });

  it("keeps local values Central does not provide", () => {
    const plan = planCentralSync(
      [person({ employeeId: null, jobTitle: null })],
      [localUser({
        email: "romasta@millennia21.id",
        centralPersonId: "person-roma",
        profile: {
          email: "romasta@millennia21.id",
          fullName: "Romasta Oryza Sativa Siagian",
          niy: "LOCAL-9",
          jobTitle: "Head of Unit",
        },
      })],
    );
    assert.deepEqual(plan.actions, []);
    assert.equal(plan.unchanged, 1);
  });
});

describe("centralSyncPeople", () => {
  it("prefers the Central employee record and marks who has access", () => {
    const entitlement = {
      person_id: "person-roma",
      person: { email: "old@millennia21.id", full_name: "Old Name" },
    } as CentralDirectoryEntitlement;
    const employees = [
      {
        person_id: "person-roma",
        email: "romasta@millennia21.id",
        full_name: "Romasta",
        status: "ACTIVE",
        employee_id: "EMP-001",
        job_position: "Principal",
      },
      { person_id: "person-other", email: "other@millennia21.id", full_name: "Other", status: "ACTIVE" },
    ] as CentralDirectoryEmployee[];

    assert.deepEqual(centralSyncPeople([entitlement], employees), [
      {
        personId: "person-roma",
        email: "romasta@millennia21.id",
        fullName: "Romasta",
        employeeId: "EMP-001",
        jobTitle: "Principal",
        hasAccess: true,
      },
      {
        personId: "person-other",
        email: "other@millennia21.id",
        fullName: "Other",
        employeeId: null,
        jobTitle: null,
        hasAccess: false,
      },
    ]);
  });
});

describe("runCentralSync", () => {
  beforeEach(() => resetCentralSyncStateForTest());

  function dependencies(overrides: Partial<CentralSyncDependencies> = {}) {
    const applied: CentralSyncAction[] = [];
    let entitlementReads = 0;
    let structureApplied = 0;
    const deps: CentralSyncDependencies = {
      getKey: async () => "key-1",
      listEntitlements: async () => {
        entitlementReads += 1;
        return [{
          person_id: "person-roma",
          role: "STAFF",
          permissions: ["proofpoint.access"],
          person: { email: "romasta@millennia21.id", full_name: "Romasta" },
        } as CentralDirectoryEntitlement];
      },
      listEmployees: async () => [],
      store: {
        listLocalUsers: async () => [localUser()],
        apply: async (action) => {
          applied.push(action);
        },
      },
      structureStore: {
        load: async () => ({ departments: [], departmentRoles: [], memberships: [], users: [] }),
        apply: async () => {
          structureApplied += 1;
        },
      },
      withLock: (run) => run(),
      ...overrides,
    };
    return { deps, applied, entitlementReads: () => entitlementReads, structureApplied: () => structureApplied };
  }

  it("applies the plan and skips the next tick while the key is unchanged", async () => {
    const { deps, applied, entitlementReads } = dependencies();
    const now = new Date("2026-11-19T08:00:00.000Z");

    const first = await runCentralSync({ dependencies: deps, now });
    assert.equal(first.status, "synced");
    assert.equal(applied.length, 1);

    const second = await runCentralSync({ dependencies: deps, now: new Date(now.getTime() + 60_000) });
    assert.equal(second.status, "unchanged");
    assert.equal(entitlementReads(), 1);
  });

  it("still syncs access when the employee roster cannot be read", async () => {
    const { deps, applied } = dependencies({
      listEmployees: async () => {
        throw new Error("missing required scope 'employees:read'");
      },
    });
    const result = await runCentralSync({ dependencies: deps });
    assert.equal(result.status, "synced");
    assert.equal(applied.length, 1);
    if (result.status === "synced") assert.match(result.warnings[0], /Employee profiles skipped/);
  });

  it("reports a Central failure without throwing", async () => {
    const { deps } = dependencies({
      getKey: async () => {
        throw new Error("Central could not be reached");
      },
    });
    assert.deepEqual(await runCentralSync({ dependencies: deps }), {
      status: "error",
      message: "Central could not be reached",
    });
  });

  it("applies department changes from Central and lists them", async () => {
    const employees = [{ person_id: "person-roma", email: "romasta@millennia21.id", full_name: "Romasta", status: "ACTIVE", unit_id: "unit-es", unit: "Elementary" }] as CentralDirectoryEmployee[];
    const { deps, structureApplied } = dependencies({ listEmployees: async () => employees });
    const result = await runCentralSync({ dependencies: deps });
    assert.equal(result.status, "synced");
    assert.equal(structureApplied(), 1);
    assert.equal(getCentralSyncStatus().structure?.mode, "applied");
    assert.deepEqual(getCentralSyncStatus().structure?.changes, ["Create department Elementary"]);
  });

  it("holds a run that would remove more than half of the memberships", async () => {
    const employees = [{ person_id: "person-roma", email: "romasta@millennia21.id", full_name: "Romasta", status: "ACTIVE", unit_id: "unit-es", unit: "Elementary" }] as CentralDirectoryEmployee[];
    const { deps, structureApplied } = dependencies({
      listEmployees: async () => employees,
      structureStore: {
        load: async () => ({
          departments: [{ id: "d-es", name: "Elementary", centralUnitId: "unit-es" }],
          departmentRoles: [{ id: "r-es-staff", departmentId: "d-es", role: "staff" }],
          memberships: [{ userId: "u-gone", departmentRoleId: "r-es-staff" }],
          users: [{ id: "u-gone", email: "gone@millennia21.id", centralPersonId: "person-gone", profileDepartmentId: null }],
        }),
        apply: async () => {
          throw new Error("must not apply");
        },
      },
    });
    const result = await runCentralSync({ dependencies: deps });
    assert.equal(structureApplied(), 0);
    assert.equal(getCentralSyncStatus().structure?.mode, "held");
    if (result.status === "synced") assert.ok(result.warnings.some((w) => /Departments held/.test(w)));
  });

  it("leaves departments alone when the employee list or the access list is missing", async () => {
    const noEmployees = dependencies({
      listEmployees: async () => {
        throw new Error("missing required scope 'employees:read'");
      },
    });
    await runCentralSync({ dependencies: noEmployees.deps });
    assert.equal(noEmployees.structureApplied(), 0);
    assert.equal(getCentralSyncStatus().structure, null);

    resetCentralSyncStateForTest();
    const nobody = dependencies({ listEntitlements: async () => [] });
    const result = await runCentralSync({ dependencies: nobody.deps });
    assert.equal(nobody.structureApplied(), 0);
    if (result.status === "synced") assert.ok(result.warnings.some((w) => /Departments skipped/.test(w)));
  });

  it("does nothing while another instance holds the lock", async () => {
    const { deps, applied } = dependencies({ withLock: async () => "locked" });
    assert.deepEqual(await runCentralSync({ dependencies: deps }), { status: "locked" });
    assert.equal(applied.length, 0);
  });
});

describe("centralSyncIntervalMs", () => {
  it("defaults to a minute, can be turned off, and never runs faster than 15 seconds", () => {
    assert.equal(centralSyncIntervalMs(undefined), 60_000);
    assert.equal(centralSyncIntervalMs("0"), 0);
    assert.equal(centralSyncIntervalMs("5"), 15_000);
    assert.equal(centralSyncIntervalMs("abc"), 60_000);
  });
});

describe("managedInCentralResponse", () => {
  it("closes admin writes whenever ProofPoint signs in through Hub", async () => {
    const saved = { mode: process.env.PROOFPOINT_AUTH_MODE };
    try {
      process.env.PROOFPOINT_AUTH_MODE = "hub";
      assert.equal(centralManagesDepartments(), true);
      const response = managedInCentralResponse();
      assert.ok(response);
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /managed in Central/);

      process.env.PROOFPOINT_AUTH_MODE = "local";
      assert.equal(managedInCentralResponse(), null);
    } finally {
      if (saved.mode === undefined) delete process.env.PROOFPOINT_AUTH_MODE;
      else process.env.PROOFPOINT_AUTH_MODE = saved.mode;
    }
  });
});

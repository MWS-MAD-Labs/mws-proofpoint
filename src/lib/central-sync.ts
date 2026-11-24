import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import {
  getCentralDirectoryKey,
  listActiveCentralEmployees,
  listCentralEntitlements,
  listCentralOrganizationUnits,
  listCentralUnitAssignments,
  type CentralDirectoryEmployee,
  type CentralDirectoryEntitlement,
  type CentralOrganizationUnit,
  type CentralUnitAssignmentDirectory,
} from "@/lib/central-access";
import {
  centralStructureInput,
  describeStructurePlan,
  pgStructureStore,
  planCentralStructure,
  structureGuardedRemovalCount,
  structurePlanRemovesTooMuch,
  type CentralStructureStore,
} from "@/lib/central-structure-sync";
import { isHubAuthEnabled } from "@/lib/hub-session";

// Keeps ProofPoint's local accounts in line with Central by itself, the same way
// Daily Check-in does. Each tick asks Central for small directory keys; the full access
// list is read only when that key moves. Employee profile fields (email, name,
// employee ID, job position) are re-read every few minutes. Access itself is still
// decided live at login, so this never grants or revokes anything: it only links,
// creates, and refreshes local identity records. Departments and memberships follow
// Central too (central-structure-sync.ts); ProofPoint has no screen to change them.

const DEFAULT_SECONDS = 60;
const MIN_SECONDS = 15;
const FIRST_RUN_MS = 10 * 1000;
const PROFILE_EVERY_MS = 5 * 60 * 1000;
export const CENTRAL_SYNC_ADVISORY_LOCK = { namespace: 1_347_436_354, key: 1_129_534_798 } as const;

export type CentralSyncPerson = {
  personId: string;
  email: string;
  fullName: string | null;
  employeeId: string | null;
  jobTitle: string | null;
  // Only people who may use ProofPoint are linked or created; everyone else who is
  // already linked still gets their profile refreshed.
  hasAccess: boolean;
};

export type CentralSyncLocalUser = {
  id: string;
  email: string;
  centralPersonId: string | null;
  profile: {
    email: string;
    fullName: string | null;
    niy: string | null;
    jobTitle: string | null;
  } | null;
};

export type CentralSyncChanges = {
  email?: string;
  fullName?: string;
  niy?: string;
  jobTitle?: string;
};

export type CentralSyncAction =
  | { kind: "create"; person: CentralSyncPerson }
  | {
      kind: "update";
      userId: string;
      personId: string;
      link: false | "email" | "employee_id";
      changes: CentralSyncChanges;
      profileEmail: string;
    };

export type CentralSyncPlan = {
  actions: CentralSyncAction[];
  warnings: string[];
  unchanged: number;
};

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() || "";
const clean = (value: string | null | undefined) => value?.trim() || null;

// Works out what to change without touching the database, so it can be tested.
export function planCentralSync(
  people: readonly CentralSyncPerson[],
  users: readonly CentralSyncLocalUser[],
): CentralSyncPlan {
  const local = users.map((user) => ({ ...user }));
  const byPersonId = new Map(
    local.filter((user) => user.centralPersonId).map((user) => [user.centralPersonId as string, user]),
  );
  const byEmail = new Map(local.map((user) => [normalize(user.email), user]));
  const unlinkedByEmployeeId = new Map<string, typeof local>();
  for (const user of local) {
    const niy = normalize(user.profile?.niy);
    if (user.centralPersonId || !niy) continue;
    unlinkedByEmployeeId.set(niy, [...(unlinkedByEmployeeId.get(niy) ?? []), user]);
  }

  const actions: CentralSyncAction[] = [];
  const warnings: string[] = [];
  let unchanged = 0;
  const seen = new Set<string>();

  for (const person of people) {
    const email = normalize(person.email);
    if (!person.personId || !email || seen.has(person.personId)) continue;
    seen.add(person.personId);

    let user = byPersonId.get(person.personId);
    let link: false | "email" | "employee_id" = false;
    if (!user) {
      if (!person.hasAccess) continue;
      const emailOwner = byEmail.get(email);
      const employeeId = normalize(person.employeeId);
      const byEmployeeId = employeeId ? unlinkedByEmployeeId.get(employeeId) ?? [] : [];
      if (emailOwner?.centralPersonId) {
        warnings.push(`${email} is already linked to another Central person; left unchanged`);
        continue;
      }
      if (emailOwner) {
        user = emailOwner;
        link = "email";
      } else if (byEmployeeId.length === 1) {
        user = byEmployeeId[0];
        link = "employee_id";
      } else if (byEmployeeId.length > 1) {
        warnings.push(`${email}: more than one local account has employee ID ${person.employeeId}; left unlinked`);
        continue;
      } else {
        actions.push({ kind: "create", person: { ...person, email } });
        byEmail.set(email, {
          id: `pending:${person.personId}`,
          email,
          centralPersonId: person.personId,
          profile: null,
        });
        continue;
      }
      user.centralPersonId = person.personId;
      byPersonId.set(person.personId, user);
      if (link === "employee_id") unlinkedByEmployeeId.delete(employeeId);
    }

    const changes: CentralSyncChanges = {};
    // Sign-in stores lower-case emails, so a case-only difference is also corrected.
    let finalEmail = user.email;
    if (user.email !== email) {
      const owner = byEmail.get(email);
      if (owner && owner.id !== user.id) {
        warnings.push(`${email} belongs to another local account; ${user.email} keeps its current email`);
      } else {
        changes.email = email;
        byEmail.delete(normalize(user.email));
        byEmail.set(email, user);
        finalEmail = email;
      }
    }
    const fullName = clean(person.fullName);
    if (fullName && user.profile?.fullName !== fullName) changes.fullName = fullName;
    const employeeId = clean(person.employeeId);
    if (employeeId && user.profile?.niy !== employeeId) changes.niy = employeeId;
    const jobTitle = clean(person.jobTitle);
    if (jobTitle && user.profile?.jobTitle !== jobTitle) changes.jobTitle = jobTitle;
    const profileEmailChanged = user.profile?.email !== finalEmail;

    if (!link && Object.keys(changes).length === 0 && !profileEmailChanged) {
      unchanged += 1;
      continue;
    }
    actions.push({
      kind: "update",
      userId: user.id,
      personId: person.personId,
      link,
      changes,
      profileEmail: finalEmail,
    });
  }

  return { actions, warnings, unchanged };
}

// Everyone Central lists for ProofPoint, plus every active employee, merged by person.
export function centralSyncPeople(
  entitlements: readonly CentralDirectoryEntitlement[],
  employees: readonly CentralDirectoryEmployee[] | null,
): CentralSyncPerson[] {
  const employeeByPerson = new Map((employees ?? []).map((employee) => [employee.person_id, employee]));
  const people = new Map<string, CentralSyncPerson>();
  const fromEmployee = (employee: CentralDirectoryEmployee | undefined) => ({
    employeeId: clean(employee?.employee_id),
    jobTitle: clean(employee?.job_position),
  });

  for (const entitlement of entitlements) {
    const employee = employeeByPerson.get(entitlement.person_id);
    people.set(entitlement.person_id, {
      personId: entitlement.person_id,
      email: employee?.email ?? entitlement.person.email,
      fullName: employee?.full_name ?? entitlement.person.full_name,
      ...fromEmployee(employee),
      hasAccess: true,
    });
  }
  for (const employee of employees ?? []) {
    if (people.has(employee.person_id)) continue;
    people.set(employee.person_id, {
      personId: employee.person_id,
      email: employee.email,
      fullName: employee.full_name,
      ...fromEmployee(employee),
      hasAccess: false,
    });
  }
  return [...people.values()];
}

export type CentralSyncStore = {
  listLocalUsers(): Promise<CentralSyncLocalUser[]>;
  apply(action: CentralSyncAction): Promise<void>;
};

const prismaStore: CentralSyncStore = {
  async listLocalUsers() {
    const { prisma } = await import("@/lib/prisma");
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        centralPersonId: true,
        profile: { select: { email: true, fullName: true, niy: true, jobTitle: true } },
      },
    });
  },
  async apply(action) {
    const { prisma } = await import("@/lib/prisma");
    const personId = action.kind === "create" ? action.person.personId : action.personId;
    await prisma.$transaction(async (tx) => {
      // The same per-person lock as sign-in, so a login and a sync never race.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${personId}))`;

      if (action.kind === "create") {
        const { person } = action;
        const existing = await tx.user.findFirst({
          where: {
            OR: [
              { centralPersonId: person.personId },
              { email: { equals: person.email, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });
        if (existing) return;
        const passwordHash = await bcrypt.hash(randomUUID(), 12);
        await tx.user.create({
          data: {
            email: person.email,
            passwordHash,
            emailVerified: true,
            centralPersonId: person.personId,
            profile: {
              create: {
                email: person.email,
                fullName: clean(person.fullName),
                niy: clean(person.employeeId),
                jobTitle: clean(person.jobTitle),
              },
            },
          },
        });
        return;
      }

      const current = await tx.user.findUnique({
        where: { id: action.userId },
        select: { centralPersonId: true },
      });
      if (!current) return;
      if (action.link && current.centralPersonId) return;
      if (!action.link && current.centralPersonId !== action.personId) return;

      const { email, ...profileChanges } = action.changes;
      await tx.user.update({
        where: { id: action.userId },
        data: {
          ...(action.link ? { centralPersonId: action.personId } : {}),
          ...(email ? { email, emailVerified: true } : {}),
          updatedAt: new Date(),
          profile: {
            upsert: {
              create: { email: action.profileEmail, ...profileChanges },
              update: { email: action.profileEmail, ...profileChanges, updatedAt: new Date() },
            },
          },
        },
      });
    });
  },
};

export type CentralSyncSummary = {
  created: number;
  linked: number;
  updated: number;
  unchanged: number;
  failed: number;
};

export type CentralStructureStatus = {
  // held: too much would be removed at once, so nothing was applied.
  mode: "applied" | "held";
  departments: { linked: number; renamed: number; created: number };
  memberships: { added: number; removed: number };
  // What the last run changed, or would have changed when held.
  changes: string[];
};

export type CentralSyncStatus = {
  checkedAt: string | null;
  syncedAt: string | null;
  profilesSyncedAt: string | null;
  lastError: string | null;
  lastSummary: CentralSyncSummary | null;
  structure: CentralStructureStatus | null;
  warnings: string[];
};

type SyncState = CentralSyncStatus & { key: string | null };

type SyncGlobal = typeof globalThis & {
  __proofPointCentralSyncState?: SyncState;
  __proofPointCentralSyncStarted?: boolean;
};

function state(): SyncState {
  const syncGlobal = globalThis as SyncGlobal;
  syncGlobal.__proofPointCentralSyncState ??= {
    key: null,
    checkedAt: null,
    syncedAt: null,
    profilesSyncedAt: null,
    lastError: null,
    lastSummary: null,
    structure: null,
    warnings: [],
  };
  return syncGlobal.__proofPointCentralSyncState;
}

export function getCentralSyncStatus(): CentralSyncStatus {
  const { key: _key, ...status } = state();
  return { ...status, warnings: [...status.warnings] };
}

export function resetCentralSyncStateForTest(): void {
  delete (globalThis as SyncGlobal).__proofPointCentralSyncState;
}

export type CentralSyncDependencies = {
  getKey(): Promise<string | null>;
  listEntitlements(): Promise<CentralDirectoryEntitlement[]>;
  listEmployees(): Promise<CentralDirectoryEmployee[]>;
  listUnits(): Promise<CentralOrganizationUnit[]>;
  listUnitAssignments(): Promise<CentralUnitAssignmentDirectory>;
  store: CentralSyncStore;
  structureStore: CentralStructureStore;
  withLock<T>(run: () => Promise<T>): Promise<T | "locked">;
};

async function withAdvisoryLock<T>(run: () => Promise<T>): Promise<T | "locked"> {
  const { pool } = await import("@/lib/db");
  const client: PoolClient = await pool.connect();
  let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      [CENTRAL_SYNC_ADVISORY_LOCK.namespace, CENTRAL_SYNC_ADVISORY_LOCK.key],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) return "locked";
    return await run();
  } finally {
    if (acquired) {
      await client
        .query("SELECT pg_advisory_unlock($1, $2)", [
          CENTRAL_SYNC_ADVISORY_LOCK.namespace,
          CENTRAL_SYNC_ADVISORY_LOCK.key,
        ])
        .catch((error) => console.error("[central-sync] Failed to release advisory lock:", error));
    }
    client.release();
  }
}

// With Hub sign-in, Central owns users, departments and memberships: ProofPoint's
// own screens and APIs for them are closed (Access Standard AS-1).
export function centralManagesDepartments(): boolean {
  return isHubAuthEnabled();
}

// The answer an admin write API gives while Central owns the data it would change.
export function managedInCentralResponse(): Response | null {
  if (!centralManagesDepartments()) return null;
  return Response.json(
    { error: "Users, roles and departments are managed in Central." },
    { status: 409 },
  );
}

const defaultDependencies: CentralSyncDependencies = {
  getKey: getCentralDirectoryKey,
  listEntitlements: listCentralEntitlements,
  listEmployees: listActiveCentralEmployees,
  listUnits: listCentralOrganizationUnits,
  listUnitAssignments: listCentralUnitAssignments,
  store: prismaStore,
  structureStore: pgStructureStore,
  withLock: withAdvisoryLock,
};

const MAX_LISTED_CHANGES = 300;

// Departments and memberships from Central. Needs complete employee and unit
// directories, and never runs on an empty access list, so a Central hiccup cannot
// empty departments.
async function syncStructure(
  dependencies: CentralSyncDependencies,
  entitlements: CentralDirectoryEntitlement[],
  employees: CentralDirectoryEmployee[] | null,
  units: CentralOrganizationUnit[] | null,
  assignmentDirectory: CentralUnitAssignmentDirectory | null,
  warnings: string[],
): Promise<CentralStructureStatus | null> {
  if (!employees || !units || !assignmentDirectory) return null;
  if (entitlements.length === 0) {
    warnings.push("Departments skipped: Central listed nobody with ProofPoint access");
    return null;
  }
  if (units.length === 0) {
    warnings.push("Departments skipped: Central listed no organization units");
    return null;
  }
  const { units: structureUnits, people, managedAssignments } = centralStructureInput(
    entitlements,
    employees,
    units,
    assignmentDirectory.assignments,
    assignmentDirectory.managed,
  );
  const local = await dependencies.structureStore.load();
  const plan = planCentralStructure(structureUnits, people, local, managedAssignments);
  warnings.push(...plan.warnings);
  const changes = describeStructurePlan(plan);
  let mode: CentralStructureStatus["mode"] = "applied";
  if (structurePlanRemovesTooMuch(plan)) {
    mode = "held";
    const guardedRemovals = structureGuardedRemovalCount(plan);
    warnings.push(
      `Departments held: ${guardedRemovals} of ${plan.managedCount} unmanaged memberships would be removed at once. Check Central, then fix or apply by hand`,
    );
  }
  if (mode === "applied" && changes.length) {
    const personIdByUser = new Map(
      local.users.filter((user) => user.centralPersonId).map((user) => [user.id, user.centralPersonId as string]),
    );
    await dependencies.structureStore.apply(plan, personIdByUser);
    console.log(`[central-sync] Departments: ${changes.length} change(s) applied`);
  }
  return {
    mode,
    departments: { linked: plan.links.length, renamed: plan.renames.length, created: plan.creates.length },
    memberships: { added: plan.adds.length, removed: plan.removes.length },
    changes: changes.slice(0, MAX_LISTED_CHANGES),
  };
}

export type CentralSyncResult =
  | { status: "locked" | "unchanged" }
  | { status: "synced"; summary: CentralSyncSummary; warnings: string[] }
  | { status: "error"; message: string };

// One tick. `force` skips the key and profile-age checks (the Sync now button).
export async function runCentralSync({
  force = false,
  now = new Date(),
  dependencies = defaultDependencies,
}: {
  force?: boolean;
  now?: Date;
  dependencies?: CentralSyncDependencies;
} = {}): Promise<CentralSyncResult> {
  const current = state();
  const outcome = await dependencies.withLock(async (): Promise<CentralSyncResult> => {
    current.checkedAt = now.toISOString();
    try {
      const key = await dependencies.getKey();
      const profilesDue =
        !current.profilesSyncedAt || now.getTime() - Date.parse(current.profilesSyncedAt) >= PROFILE_EVERY_MS;
      if (!force && key !== null && key === current.key && !profilesDue) {
        current.lastError = null;
        return { status: "unchanged" };
      }

      const warnings: string[] = [];
      const entitlements = await dependencies.listEntitlements();
      const employees = await dependencies.listEmployees().catch((error: unknown) => {
        warnings.push(`Employee profiles skipped: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
      const units = await dependencies.listUnits().catch((error: unknown) => {
        warnings.push(`Departments skipped: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
      const unitAssignments = await dependencies.listUnitAssignments().catch((error: unknown) => {
        warnings.push(`Department assignments skipped: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });

      const users = await dependencies.store.listLocalUsers();
      const plan = planCentralSync(centralSyncPeople(entitlements, employees), users);
      warnings.push(...plan.warnings);
      const summary: CentralSyncSummary = {
        created: 0,
        linked: 0,
        updated: 0,
        unchanged: plan.unchanged,
        failed: 0,
      };
      for (const action of plan.actions) {
        try {
          await dependencies.store.apply(action);
          if (action.kind === "create") summary.created += 1;
          else if (action.link) summary.linked += 1;
          else summary.updated += 1;
        } catch (error) {
          summary.failed += 1;
          const who = action.kind === "create" ? action.person.email : action.profileEmail;
          warnings.push(`${who}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      try {
        const structure = await syncStructure(dependencies, entitlements, employees, units, unitAssignments, warnings);
        if (structure) current.structure = structure;
      } catch (error) {
        warnings.push(`Departments failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      current.key = key;
      current.syncedAt = now.toISOString();
      if (employees) current.profilesSyncedAt = now.toISOString();
      current.lastSummary = summary;
      current.warnings = warnings;
      current.lastError = null;
      if (warnings.length) console.warn(`[central-sync] ${warnings.join("; ")}`);
      if (summary.created || summary.linked || summary.updated || summary.failed) {
        console.log("[central-sync] Run completed:", summary);
      }
      return { status: "synced", summary, warnings };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      current.lastError = message;
      console.warn(`[central-sync] ${message}`);
      return { status: "error", message };
    }
  });
  return outcome === "locked" ? { status: "locked" } : outcome;
}

// 0 turns it off. Anything unusable falls back to the default; nothing runs faster than 15 seconds.
export function centralSyncIntervalMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_SECONDS * 1000;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_SECONDS * 1000;
  if (seconds === 0) return 0;
  return Math.max(seconds, MIN_SECONDS) * 1000;
}

export function startCentralSyncScheduler(): void {
  const syncGlobal = globalThis as SyncGlobal;
  if (syncGlobal.__proofPointCentralSyncStarted || !isHubAuthEnabled()) return;
  const intervalMs = centralSyncIntervalMs(process.env.PROOFPOINT_CENTRAL_SYNC_SECONDS);
  if (intervalMs <= 0) return;
  syncGlobal.__proofPointCentralSyncStarted = true;

  const scheduleNextRun = (delayMs: number) => {
    const timer = setTimeout(async () => {
      try {
        await runCentralSync();
      } catch (error) {
        console.error("[central-sync] Unexpected run failure:", error);
      } finally {
        scheduleNextRun(intervalMs);
      }
    }, delayMs);
    timer.unref();
  };

  scheduleNextRun(FIRST_RUN_MS);
  console.log(`[central-sync] Started; checking Central every ${Math.round(intervalMs / 1000)} seconds.`);
}

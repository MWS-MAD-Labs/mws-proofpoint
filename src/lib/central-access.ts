import { centralApiBase, centralApiToken, centralAuthHeaders, centralOrganizationId } from "@/lib/central-config";

export const PROOFPOINT_PERMISSIONS = [
  "proofpoint.access",
  "proofpoint.admin",
  "proofpoint.director",
  "proofpoint.manager",
  "proofpoint.supervisor",
  "proofpoint.staff",
  "proofpoint.instructional_coach",
] as const;

export type ProofPointRole =
  | "admin"
  | "director"
  | "manager"
  | "supervisor"
  | "staff"
  | "instructional_coach";

const ROLE_PERMISSION: ReadonlyArray<readonly [string, ProofPointRole]> = [
  ["proofpoint.admin", "admin"],
  ["proofpoint.director", "director"],
  ["proofpoint.manager", "manager"],
  ["proofpoint.supervisor", "supervisor"],
  ["proofpoint.staff", "staff"],
  ["proofpoint.instructional_coach", "instructional_coach"],
];

// Roles that apply across the organization without a local department membership.
export const UNSCOPED_ROLES: ReadonlySet<ProofPointRole> = new Set([
  "admin",
  "director",
  "instructional_coach",
]);
const SCOPED_ROLES: ReadonlySet<ProofPointRole> = new Set(["manager", "supervisor", "staff"]);

export type CentralEntitlement = {
  id: string;
  person_id: string;
  application_id: string;
  organization_id: string;
  role: string;
  permissions: string[];
  // Units the role reaches, chosen in Central (Access Standard AS-8). Empty or
  // missing means the person's own unit.
  scope_unit_ids?: string[];
  version: number;
  is_active: boolean;
};

export type CentralDirectoryEntitlement = CentralEntitlement & {
  person: {
    email: string;
    full_name: string | null;
  };
};

export type CentralUnitAssignment = {
  person_id: string;
  unit_id: string;
  permission_key: string;
};

export type CentralUnitAssignmentSet = {
  unit_id: string;
  permission_key: string;
};

export type CentralUnitAssignmentDirectory = {
  assignments: CentralUnitAssignment[];
  managed: CentralUnitAssignmentSet[];
};

export type CentralEmployeeProfile = {
  person_id: string;
  full_name: string;
  email: string;
  status: string;
};

export class CentralUnavailableError extends Error {
  constructor(message = "Central could not be reached") {
    super(message);
    this.name = "CentralUnavailableError";
  }
}

function cacheDurationMs(): number {
  const seconds = Number(process.env.PROOFPOINT_CENTRAL_ACCESS_CACHE_SECONDS);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 30) * 1000;
}

const cache = new Map<string, { entitlement: CentralEntitlement; at: number }>();
const employeeCache = new Map<string, { employee: CentralEmployeeProfile; at: number }>();
const supportedPermissions = new Set<string>(PROOFPOINT_PERMISSIONS);

export function clearCentralEntitlementCacheForTest(): void {
  cache.clear();
  employeeCache.clear();
}

export function rolesFromCentralEntitlement(
  _role: string,
  permissions: readonly string[],
): ProofPointRole[] {
  if (!permissions.includes("proofpoint.access")) return [];
  const granted = new Set(permissions);
  return ROLE_PERMISSION.flatMap(([permission, role]) =>
    granted.has(permission) ? [role] : [],
  );
}

export function hasProofPointAccess(permissions: readonly string[]): boolean {
  return permissions.includes("proofpoint.access");
}

export function rolesWithinLocalDepartmentScope(
  entitledRoles: readonly ProofPointRole[],
  membershipRoles: readonly string[],
): ProofPointRole[] {
  const globalRoles = entitledRoles.filter((role) => UNSCOPED_ROLES.has(role));
  const scopedRoles = membershipRoles.filter(
    (role): role is ProofPointRole => SCOPED_ROLES.has(role as ProofPointRole),
  );
  return [...new Set([...globalRoles, ...scopedRoles])];
}

export function validateCentralEntitlement(
  personId: string,
  entitlement: CentralEntitlement,
): CentralEntitlement {
  const applicationId = process.env.HUB_SSO_APP_ID?.trim() || "proofpoint";
  const organizationId = centralOrganizationId();
  // Older Central group grants used version 0; current deployments use a
  // monotonically increasing directory version. Both are valid revisions.
  const isGroupEntitlement =
    typeof entitlement.id === "string" && entitlement.id.startsWith("group:");
  const validVersion = Number.isInteger(entitlement.version) && (
    isGroupEntitlement ? entitlement.version >= 0 : entitlement.version >= 1
  );

  if (
    !organizationId ||
    typeof entitlement.id !== "string" ||
    entitlement.id.length === 0 ||
    typeof entitlement.person_id !== "string" ||
    entitlement.person_id !== personId ||
    typeof entitlement.role !== "string" ||
    !/^[A-Z][A-Z0-9_]*$/.test(entitlement.role) ||
    !Number.isInteger(entitlement.version) ||
    !validVersion ||
    entitlement.is_active !== true ||
    entitlement.application_id !== applicationId ||
    entitlement.organization_id !== organizationId ||
    !Array.isArray(entitlement.permissions) ||
    entitlement.permissions.some(
      (permission) =>
        typeof permission !== "string" || !supportedPermissions.has(permission),
    )
  ) {
    console.error("[central-auth] Central returned an invalid or mismatched ProofPoint entitlement");
    throw new CentralUnavailableError("Central entitlement is invalid for this application");
  }

  return entitlement;
}

export async function lookupCentralEntitlement(personId: string): Promise<CentralEntitlement | null> {
  const cached = cache.get(personId);
  if (cached && Date.now() - cached.at < cacheDurationMs()) return cached.entitlement;

  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  const applicationId = process.env.HUB_SSO_APP_ID?.trim() || "proofpoint";
  const url = new URL(`${base}/application-entitlements/lookup`);
  url.searchParams.set("person_id", personId);
  url.searchParams.set("application_id", applicationId);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...centralAuthHeaders(token), accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[central-auth] Entitlement lookup failed", error instanceof Error ? error.message : error);
    throw new CentralUnavailableError();
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: CentralEntitlement | null; code?: string }
    | null;
  if (response.status === 404 || (response.status === 403 && body?.code === "application_retired")) {
    cache.delete(personId);
    return null;
  }
  if (!response.ok || !body || !("data" in body)) {
    console.error(`[central-auth] Entitlement lookup returned HTTP ${response.status}`);
    throw new CentralUnavailableError("Central entitlement lookup failed");
  }

  const entitlement = body.data ?? null;
  if (!entitlement?.is_active) {
    cache.delete(personId);
    return null;
  }
  validateCentralEntitlement(personId, entitlement);
  if (!hasProofPointAccess(entitlement.permissions)) {
    cache.delete(personId);
    return null;
  }

  cache.set(personId, { entitlement, at: Date.now() });
  return entitlement;
}

export async function lookupCentralEmployee(
  personId: string,
): Promise<CentralEmployeeProfile | null> {
  const cached = employeeCache.get(personId);
  if (cached && Date.now() - cached.at < cacheDurationMs()) {
    return cached.employee;
  }
  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  const url = new URL(`${base}/employees/lookup`);
  url.searchParams.set("person_id", personId);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...centralAuthHeaders(token), accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[central-auth] Employee lookup failed", error instanceof Error ? error.message : error);
    throw new CentralUnavailableError();
  }

  if (response.status === 404) {
    employeeCache.delete(personId);
    return null;
  }
  const body = (await response.json().catch(() => null)) as
    | { data?: CentralEmployeeProfile | null }
    | null;
  if (!response.ok || !body?.data) {
    throw new CentralUnavailableError("Central employee lookup failed");
  }

  const employee = body.data;
  if (
    employee.person_id !== personId ||
    typeof employee.full_name !== "string" ||
    employee.full_name.trim().length === 0 ||
    typeof employee.email !== "string" ||
    employee.email.trim().length === 0 ||
    typeof employee.status !== "string" ||
    employee.status.toUpperCase() !== "ACTIVE"
  ) {
    throw new CentralUnavailableError("Central returned an invalid employee profile");
  }
  employeeCache.set(personId, { employee, at: Date.now() });
  return employee;
}

export async function listCentralEntitlements(): Promise<CentralDirectoryEntitlement[]> {
  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  const applicationId = process.env.HUB_SSO_APP_ID?.trim() || "proofpoint";
  const rows: CentralDirectoryEntitlement[] = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(`${base}/application-entitlements`);
    url.searchParams.set("application_id", applicationId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "100");

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { ...centralAuthHeaders(token), accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (error) {
      console.error("[central-auth] Entitlement directory failed", error instanceof Error ? error.message : error);
      throw new CentralUnavailableError();
    }

    const body = (await response.json().catch(() => null)) as
      | {
          data?: CentralDirectoryEntitlement[];
          paging?: { total_page: number };
        }
      | null;
    if (!response.ok || !body?.data || !body.paging) {
      throw new CentralUnavailableError("Central entitlement directory lookup failed");
    }

    for (const entitlement of body.data) {
      validateCentralEntitlement(entitlement.person_id, entitlement);
      if (hasProofPointAccess(entitlement.permissions)) {
        rows.push(entitlement);
      }
    }

    if (page >= body.paging.total_page) break;
  }

  return rows;
}

export type CentralDirectoryEmployee = CentralEmployeeProfile & {
  employee_id?: string | null;
  job_position?: string | null;
  unit?: string | null;
  unit_id?: string | null;
};

export type CentralOrganizationUnit = {
  id: string;
  name: string;
  parent_unit_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

// A short key that changes whenever who may use ProofPoint, or what Central keeps
// about their access, changes. One small call, so it can be asked every minute.
export async function getCentralEntitlementKey(): Promise<string | null> {
  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  const url = new URL(`${base}/application-entitlements/version`);
  url.searchParams.set("application_id", process.env.HUB_SSO_APP_ID?.trim() || "proofpoint");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...centralAuthHeaders(token), accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[central-sync] Entitlement version lookup failed", error instanceof Error ? error.message : error);
    throw new CentralUnavailableError();
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: { key?: string | null } | null }
    | null;
  if (!response.ok || !body || !("data" in body)) {
    throw new CentralUnavailableError("Central entitlement version lookup failed");
  }
  return body.data?.key ?? null;
}

export async function getCentralOrganizationUnitKey(): Promise<string | null> {
  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  let response: Response;
  try {
    response = await fetch(`${base}/organization-units/version`, {
      headers: { ...centralAuthHeaders(token), accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[central-sync] Organization unit version lookup failed", error instanceof Error ? error.message : error);
    throw new CentralUnavailableError();
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: { key?: string | null } | null }
    | null;
  if (!response.ok || !body || !("data" in body)) {
    throw new CentralUnavailableError("Central organization unit version lookup failed");
  }
  return body.data?.key ?? null;
}

export async function getCentralDirectoryKey(): Promise<string | null> {
  const [entitlementKey, unitKey] = await Promise.all([
    getCentralEntitlementKey(),
    getCentralOrganizationUnitKey(),
  ]);
  return entitlementKey === null && unitKey === null
    ? null
    : `${entitlementKey ?? ""}:${unitKey ?? ""}`;
}

export async function listCentralOrganizationUnits(): Promise<CentralOrganizationUnit[]> {
  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  let response: Response;
  try {
    response = await fetch(`${base}/organization-units`, {
      headers: { ...centralAuthHeaders(token), accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[central-sync] Organization unit directory failed", error instanceof Error ? error.message : error);
    throw new CentralUnavailableError();
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: CentralOrganizationUnit[] }
    | null;
  if (!response.ok || !Array.isArray(body?.data)) {
    throw new CentralUnavailableError(`Central organization unit directory lookup failed (HTTP ${response.status})`);
  }
  for (const unit of body.data) {
    if (!unit || typeof unit.id !== "string" || !unit.id.trim() || typeof unit.name !== "string" || !unit.name.trim()) {
      throw new CentralUnavailableError("Central returned an invalid organization unit");
    }
    if (unit.parent_unit_id !== undefined && unit.parent_unit_id !== null && typeof unit.parent_unit_id !== "string") {
      throw new CentralUnavailableError("Central returned an invalid parent organization unit");
    }
  }
  return body.data;
}

export async function listCentralUnitAssignments(): Promise<CentralUnitAssignmentDirectory> {
  const base = centralApiBase();
  const token = centralApiToken();
  if (!base || !token || !centralOrganizationId()) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }
  let response: Response;
  try {
    const applicationId = process.env.HUB_SSO_APP_ID?.trim() || "proofpoint";
    response = await fetch(`${base}/application-entitlements/unit-assignments?application_id=${encodeURIComponent(applicationId)}`, {
      headers: { ...centralAuthHeaders(token), accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[central-sync] Unit assignments failed", error instanceof Error ? error.message : error);
    throw new CentralUnavailableError();
  }
  const body = (await response.json().catch(() => null)) as {
    data?: CentralUnitAssignment[];
    managed?: CentralUnitAssignmentSet[];
  } | null;
  if (!response.ok || !Array.isArray(body?.data) || !Array.isArray(body.managed)) {
    throw new CentralUnavailableError(`Central unit assignment lookup failed (HTTP ${response.status})`);
  }
  return { assignments: body.data, managed: body.managed };
}

// Every active employee in Central. Throws on any page failure instead of
// returning a partial list, so callers never act on an incomplete roster.
export async function listActiveCentralEmployees(): Promise<CentralDirectoryEmployee[]> {
  const base = centralApiBase();
  const token = centralApiToken();
  const organizationId = centralOrganizationId();
  if (!base || !token || !organizationId) {
    throw new CentralUnavailableError("Central API configuration is incomplete");
  }

  const employees: CentralDirectoryEmployee[] = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`${base}/employees`);
    url.searchParams.set("status", "ACTIVE");
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "100");

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { ...centralAuthHeaders(token), accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (error) {
      console.error("[central-sync] Employee directory failed", error instanceof Error ? error.message : error);
      throw new CentralUnavailableError();
    }

    const body = (await response.json().catch(() => null)) as
      | { data?: CentralDirectoryEmployee[]; paging?: { total_page: number }; errors?: unknown }
      | null;
    if (!response.ok || !body?.data || !body.paging) {
      const detail = typeof body?.errors === "string" ? `: ${body.errors}` : "";
      throw new CentralUnavailableError(`Central employee directory lookup failed (HTTP ${response.status})${detail}`);
    }

    employees.push(...body.data);
    if (page >= body.paging.total_page) break;
  }
  return employees;
}

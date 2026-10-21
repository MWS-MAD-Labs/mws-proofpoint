import { centralApiBase, centralApiToken, centralAuthHeaders, centralOrganizationId } from "@/lib/central-config";

export const PROOFPOINT_PERMISSIONS = [
  "proofpoint.access",
  "proofpoint.admin",
  "proofpoint.director",
  "proofpoint.manager",
  "proofpoint.supervisor",
  "proofpoint.staff",
] as const;

export type ProofPointRole = "admin" | "director" | "manager" | "supervisor" | "staff";

export const ROLE_PERMISSION: Record<ProofPointRole, (typeof PROOFPOINT_PERMISSIONS)[number]> = {
  admin: "proofpoint.admin",
  director: "proofpoint.director",
  manager: "proofpoint.manager",
  supervisor: "proofpoint.supervisor",
  staff: "proofpoint.staff",
};

export type CentralEntitlement = {
  id: string;
  application_id: string;
  organization_id: string;
  role: string;
  permissions: string[];
  version: number;
  is_active: boolean;
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
const supportedPermissions = new Set<string>(PROOFPOINT_PERMISSIONS);

export function clearCentralEntitlementCacheForTest(): void {
  cache.clear();
}

export function rolesFromPermissions(permissions: readonly string[]): ProofPointRole[] {
  if (!permissions.includes("proofpoint.access")) return [];
  return (Object.keys(ROLE_PERMISSION) as ProofPointRole[]).filter((role) =>
    permissions.includes(ROLE_PERMISSION[role]),
  );
}

export function rolesWithinLocalDepartmentScope(
  entitledRoles: readonly ProofPointRole[],
  membershipRoles: readonly string[],
): ProofPointRole[] {
  const localRoles = new Set(membershipRoles);
  return entitledRoles.filter((role) =>
    role === "admin" || role === "director" || localRoles.has(role),
  );
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
  if (
    typeof entitlement.id !== "string" ||
    entitlement.id.length === 0 ||
    typeof entitlement.role !== "string" ||
    !/^[A-Z][A-Z0-9_]*$/.test(entitlement.role) ||
    !Number.isInteger(entitlement.version) ||
    entitlement.version < 1 ||
    entitlement.is_active !== true ||
    entitlement.application_id !== applicationId ||
    entitlement.organization_id !== organizationId ||
    !Array.isArray(entitlement.permissions) ||
    entitlement.permissions.some((permission) => typeof permission !== "string" || !supportedPermissions.has(permission))
  ) {
    console.error("[central-auth] Central returned an invalid or mismatched ProofPoint entitlement");
    throw new CentralUnavailableError("Central entitlement is invalid for this application");
  }
  if (rolesFromPermissions(entitlement.permissions).length === 0) {
    cache.delete(personId);
    return null;
  }

  cache.set(personId, { entitlement, at: Date.now() });
  return entitlement;
}

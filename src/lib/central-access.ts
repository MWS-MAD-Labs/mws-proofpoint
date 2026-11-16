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

export const CENTRAL_ROLE: Record<string, ProofPointRole> = {
  ADMIN: "admin",
  DIRECTOR: "director",
  MANAGER: "manager",
  SUPERVISOR: "supervisor",
  STAFF: "staff",
};

export type CentralEntitlement = {
  id: string;
  person_id: string;
  application_id: string;
  organization_id: string;
  role: string;
  permissions: string[];
  version: number;
  is_active: boolean;
};

export type CentralDirectoryEntitlement = CentralEntitlement & {
  person: {
    email: string;
    full_name: string | null;
  };
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

export function rolesFromCentralEntitlement(
  role: string,
  permissions: readonly string[],
): ProofPointRole[] {
  if (!permissions.includes("proofpoint.access")) return [];
  const configuredRole = CENTRAL_ROLE[role];
  return configuredRole ? [configuredRole] : [];
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
  if (rolesFromCentralEntitlement(entitlement.role, entitlement.permissions).length === 0) {
    cache.delete(personId);
    return null;
  }

  cache.set(personId, { entitlement, at: Date.now() });
  return entitlement;
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
      if (rolesFromCentralEntitlement(entitlement.role, entitlement.permissions).length > 0) {
        rows.push(entitlement);
      }
    }

    if (page >= body.paging.total_page) break;
  }

  return rows;
}

import "dotenv/config";

import { centralApiBase, centralApiToken, centralAuthHeaders } from "@/lib/central-config";
import { PROOFPOINT_PERMISSIONS, ROLE_PERMISSION } from "@/lib/central-access";

type PermissionEntry = {
  key: string;
  description: string;
  requires?: string[];
};

type RegisteredPermission = {
  key: string;
  requires: string[];
  deprecated: boolean;
};

const permissionManifest: PermissionEntry[] = [
  { key: "proofpoint.access", description: "May access ProofPoint through MWS Hub" },
  ...Object.entries(ROLE_PERMISSION).map(([role, key]) => ({
    key,
    description: `Grants the ${role} role scope in ProofPoint`,
    requires: ["proofpoint.access"],
  })),
];

function configuration() {
  const base = centralApiBase();
  const token = centralApiToken();
  if (!base || !token) {
    throw new Error("CENTRAL_API_BASE_URL and CENTRAL_API_TOKEN are required");
  }
  return {
    base,
    token,
    applicationId: process.env.HUB_SSO_APP_ID?.trim() || "proofpoint",
  };
}

async function centralRequest<T>(
  path: string,
  method: "GET" | "PUT" = "GET",
  body?: unknown,
): Promise<T> {
  const { base, token } = configuration();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...centralAuthHeaders(token),
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`Central permission request failed: ${error instanceof Error ? error.message : "network error"}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; errors?: string }
    | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(`Central permission request failed (HTTP ${response.status})${payload?.errors ? `: ${payload.errors}` : ""}`);
  }
  return payload.data as T;
}

function comparePermissions(registered: RegisteredPermission[], usage: string[]) {
  const current = registered.filter((permission) => !permission.deprecated);
  const codeKeys = new Set(PROOFPOINT_PERMISSIONS);
  const requirementsByKey = new Map(permissionManifest.map(({ key, requires = [] }) => [key, [...requires].sort()]));
  return {
    missingInCentral: PROOFPOINT_PERMISSIONS.filter((key) => !current.some((row) => row.key === key)),
    unusedInCode: current.filter((row) => !codeKeys.has(row.key as (typeof PROOFPOINT_PERMISSIONS)[number])).map((row) => row.key),
    unknownInUse: usage.filter((key) => !codeKeys.has(key as (typeof PROOFPOINT_PERMISSIONS)[number])),
    requirementsDiffer: current
      .filter((row) => requirementsByKey.has(row.key))
      .filter((row) => [...(row.requires ?? [])].sort().join(",") !== requirementsByKey.get(row.key)?.join(","))
      .map((row) => row.key),
  };
}

async function sync() {
  const { applicationId } = configuration();
  const result = await centralRequest<{
    application_id: string;
    total: number;
    added: number;
    deprecated: string[];
    affected_roles: { role: string; permissions: string[] }[];
  }>(`/application-permissions/${encodeURIComponent(applicationId)}`, "PUT", {
    permissions: permissionManifest,
  });
  console.info(`Published ${result.total} ProofPoint permissions; added ${result.added}.`);
  if (result.deprecated.length) {
    console.error(`Central deprecated permissions: ${result.deprecated.join(", ")}`);
  }
  if (result.affected_roles.length) {
    console.error("Active Central roles still use permissions marked deprecated:", result.affected_roles);
  }
  if (result.deprecated.length || result.affected_roles.length) {
    throw new Error("Central permission removals need review before this deployment can continue");
  }
}

async function check() {
  const { applicationId } = configuration();
  const path = `/application-permissions/${encodeURIComponent(applicationId)}`;
  const [registered, usage] = await Promise.all([
    centralRequest<RegisteredPermission[]>(path),
    centralRequest<string[]>(`${path}/usage`),
  ]);
  const result = comparePermissions(registered, usage);
  if (Object.values(result).some((values) => values.length > 0)) {
    console.error("ProofPoint permission manifest differs from Central:", result);
    process.exitCode = 1;
    return;
  }
  console.info("ProofPoint permissions match Central.");
}

const command = process.argv[2];
if (command === "sync") {
  await sync();
} else if (command === "check") {
  await check();
} else {
  throw new Error("Usage: tsx scripts/sync-central-permissions.ts <sync|check>");
}

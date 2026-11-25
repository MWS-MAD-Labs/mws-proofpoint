import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

export const permissionManifest = [
  {
    key: "proofpoint.access",
    description: "May access ProofPoint through MWS Hub",
  },
  {
    key: "proofpoint.admin",
    description: "Administer ProofPoint settings and access all administration features",
    requires: ["proofpoint.access"],
  },
  {
    key: "proofpoint.director",
    description: "Use ProofPoint director features across the organization",
    requires: ["proofpoint.access"],
  },
  {
    key: "proofpoint.manager",
    description: "Manage ProofPoint work within the units selected in Central",
    requires: ["proofpoint.access"],
    unit_assignment: {
      scope: "unit",
      label: "Managers",
      mode: "explicit",
      exclusive_group: "proofpoint.department_role",
      include_descendants: true,
    },
  },
  {
    key: "proofpoint.supervisor",
    description: "Supervise ProofPoint work within the units selected in Central",
    requires: ["proofpoint.access"],
    unit_assignment: {
      scope: "unit",
      label: "Supervisors",
      mode: "explicit",
      exclusive_group: "proofpoint.department_role",
    },
  },
  {
    key: "proofpoint.staff",
    description: "Use ProofPoint as staff within the units selected in Central",
    requires: ["proofpoint.access"],
    unit_assignment: {
      scope: "unit",
      label: "Staff",
      mode: "derived_home_unit",
    },
  },
  {
    key: "proofpoint.instructional_coach",
    description: "Use ProofPoint instructional coaching features across the organization",
    requires: ["proofpoint.access"],
  },
];

function value(name) {
  return process.env[name]?.trim() || null;
}

function configuration() {
  const configuredBase = value("CENTRAL_API_BASE_URL");
  const token = value("CENTRAL_API_TOKEN");
  const organizationId = value("CENTRAL_ORGANIZATION_ID");
  if (!configuredBase || !token || !organizationId) {
    throw new Error(
      "CENTRAL_API_BASE_URL, CENTRAL_API_TOKEN, and CENTRAL_ORGANIZATION_ID are required",
    );
  }

  const normalizedBase = configuredBase.replace(/\/+$/, "");
  return {
    base: normalizedBase.endsWith("/api/internal")
      ? normalizedBase
      : `${normalizedBase}/api/internal`,
    token,
    organizationId,
    applicationId: value("HUB_SSO_APP_ID") || "proofpoint",
  };
}

async function centralRequest(path, method = "GET", body) {
  const { base, token, organizationId } = configuration();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "x-central-organization-id": organizationId,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `Central permission request failed: ${error instanceof Error ? error.message : "network error"}`,
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(
      `Central permission request failed (HTTP ${response.status})${payload?.errors ? `: ${payload.errors}` : ""}`,
    );
  }
  return payload.data;
}

function comparePermissions(registered, usage) {
  const current = registered.filter((permission) => !permission.deprecated);
  const codeKeys = new Set(permissionManifest.map(({ key }) => key));
  const requirementsByKey = new Map(
    permissionManifest.map(({ key, requires = [] }) => [
      key,
      [...requires].sort(),
    ]),
  );
  const assignmentByKey = new Map(
    permissionManifest.map(({ key, unit_assignment = null }) => [key, unit_assignment]),
  );
  const assignmentShape = (value) => value
    ? {
        scope: value.scope,
        label: value.label,
        mode: value.mode,
        exclusive_group: value.exclusive_group ?? null,
        include_descendants: value.include_descendants ?? false,
      }
    : null;
  return {
    missingInCentral: [...codeKeys].filter(
      (key) => !current.some((row) => row.key === key),
    ),
    unusedInCode: current
      .filter((row) => !codeKeys.has(row.key))
      .map((row) => row.key),
    unknownInUse: usage.filter((key) => !codeKeys.has(key)),
    requirementsDiffer: current
      .filter((row) => requirementsByKey.has(row.key))
      .filter(
        (row) =>
          [...(row.requires ?? [])].sort().join(",") !==
          requirementsByKey.get(row.key).join(","),
      )
      .map((row) => row.key),
    unitAssignmentsDiffer: current
      .filter((row) => assignmentByKey.has(row.key))
      .filter(
        (row) =>
          JSON.stringify(assignmentShape(row.unit_assignment)) !==
          JSON.stringify(assignmentShape(assignmentByKey.get(row.key))),
      )
      .map((row) => row.key),
  };
}

async function sync() {
  const { applicationId } = configuration();
  const result = await centralRequest(
    `/application-permissions/${encodeURIComponent(applicationId)}`,
    "PUT",
    { permissions: permissionManifest },
  );
  console.info(
    `Published ${result.total} ProofPoint permissions; added ${result.added}.`,
  );
  if (result.deprecated.length) {
    console.error(
      `Central deprecated permissions: ${result.deprecated.join(", ")}`,
    );
  }
  if (result.affected_roles.length) {
    console.error(
      "Active Central roles still use permissions marked deprecated:",
      result.affected_roles,
    );
  }
  if (result.deprecated.length || result.affected_roles.length) {
    throw new Error(
      "Central permission removals need review before this deployment can continue",
    );
  }
}

async function check() {
  const { applicationId } = configuration();
  const path = `/application-permissions/${encodeURIComponent(applicationId)}`;
  const [registered, usage] = await Promise.all([
    centralRequest(path),
    centralRequest(`${path}/usage`),
  ]);
  const result = comparePermissions(registered, usage);
  if (Object.values(result).some((values) => values.length > 0)) {
    console.error("ProofPoint permission manifest differs from Central:", result);
    process.exitCode = 1;
    return false;
  }
  console.info("ProofPoint permissions match Central.");
  return true;
}

async function main() {
  const command = process.argv[2] || "sync";
  if (command === "sync") {
    await sync();
    await check();
  } else if (command === "check") {
    await check();
  } else {
    throw new Error(
      "Usage: node scripts/sync-permissions.mjs [sync|check]",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

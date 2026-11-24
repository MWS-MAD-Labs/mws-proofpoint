import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { permissionManifest } from "../../scripts/sync-permissions.mjs";
import {
  PROOFPOINT_PERMISSIONS,
  rolesFromCentralEntitlement,
  rolesWithinLocalDepartmentScope,
  validateCentralEntitlement,
} from "@/lib/central-access";

const originalEnvironment = {
  organizationId: process.env.CENTRAL_ORGANIZATION_ID,
  applicationId: process.env.HUB_SSO_APP_ID,
};

process.env.CENTRAL_ORGANIZATION_ID = "organization-1";
process.env.HUB_SSO_APP_ID = "proofpoint";

test.after(() => {
  if (originalEnvironment.organizationId === undefined) delete process.env.CENTRAL_ORGANIZATION_ID;
  else process.env.CENTRAL_ORGANIZATION_ID = originalEnvironment.organizationId;
  if (originalEnvironment.applicationId === undefined) delete process.env.HUB_SSO_APP_ID;
  else process.env.HUB_SSO_APP_ID = originalEnvironment.applicationId;
});

test("the deployment manifest publishes every permission accepted by ProofPoint", () => {
  assert.deepEqual(
    permissionManifest.map(({ key }) => key),
    [...PROOFPOINT_PERMISSIONS],
  );
});

test("every preset role uses only permissions from the deployment manifest", () => {
  const preset = JSON.parse(readFileSync("role-presets.json", "utf8")) as {
    roles: Array<{ permissions: string[] }>;
  };
  const published = new Set(permissionManifest.map(({ key }) => key));
  assert.deepEqual(
    preset.roles.flatMap(({ permissions }) => permissions).filter((permission) => !published.has(permission)),
    [],
  );
});

test("Central permissions grant ProofPoint capabilities only with application access", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("MANAGER", ["proofpoint.access", "proofpoint.manager"]),
    ["manager"],
  );
  assert.deepEqual(rolesFromCentralEntitlement("MANAGER", ["proofpoint.manager"]), []);
});

test("one Central role may grant global and department capabilities together", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("ADMIN_MANAGER", [
      "proofpoint.access",
      "proofpoint.admin",
      "proofpoint.manager",
    ]),
    ["admin", "manager"],
  );
});

test("the Central role label does not grant capabilities by itself", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("ADMIN", ["proofpoint.access"]),
    [],
  );
});

test("departmental roles require a matching ProofPoint department membership", () => {
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["manager", "staff"], ["staff"]),
    ["staff"],
  );
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["admin"], ["manager"]),
    ["admin", "manager"],
  );
});

test("Central admin and director roles remain global", () => {
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["admin", "director"], []),
    ["admin", "director"],
  );
});

test("the Central instructional coach role is global and needs no department membership", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("INSTRUCTIONAL_COACH", [
      "proofpoint.access",
      "proofpoint.instructional_coach",
    ]),
    ["instructional_coach"],
  );
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["instructional_coach"], []),
    ["instructional_coach"],
  );
});

test("Central entitlements are bound to the authenticated Hub person", () => {
  const entitlement = {
    id: "entitlement-1",
    person_id: "another-person",
    application_id: "proofpoint",
    organization_id: "organization-1",
    role: "ADMIN",
    permissions: ["proofpoint.access", "proofpoint.admin"],
    version: 1,
    is_active: true,
  };

  assert.throws(
    () => validateCentralEntitlement("hub-person", entitlement),
    /invalid for this application/,
  );
});

test("Central group entitlements accept the contract's zero version", () => {
  const entitlement = {
    id: "group:proofpoint-employees",
    person_id: "hub-person",
    application_id: "proofpoint",
    organization_id: "organization-1",
    role: "STAFF",
    permissions: ["proofpoint.access", "proofpoint.staff"],
    version: 0,
    is_active: true,
  };

  assert.equal(validateCentralEntitlement("hub-person", entitlement), entitlement);
});

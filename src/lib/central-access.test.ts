import assert from "node:assert/strict";
import test from "node:test";
import { permissionManifest } from "../../scripts/sync-permissions.mjs";
import {
  CENTRAL_ROLE,
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

test("Central role keys map to the existing ProofPoint roles", () => {
  assert.deepEqual(
    Object.entries(CENTRAL_ROLE),
    [
      ["ADMIN", "admin"],
      ["DIRECTOR", "director"],
      ["MANAGER", "manager"],
      ["SUPERVISOR", "supervisor"],
      ["STAFF", "staff"],
    ],
  );
});

test("the Central role is accepted only when application access is granted", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("MANAGER", ["proofpoint.access", "proofpoint.manager"]),
    ["manager"],
  );
  assert.deepEqual(rolesFromCentralEntitlement("MANAGER", ["proofpoint.manager"]), []);
});

test("role-like permissions cannot override the role configured in Central", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("STAFF", [
      "proofpoint.access",
      "proofpoint.admin",
      "proofpoint.supervisor",
    ]),
    ["staff"],
  );
});

test("an unsupported Central role grants no ProofPoint role", () => {
  assert.deepEqual(
    rolesFromCentralEntitlement("OBSERVER", ["proofpoint.access"]),
    [],
  );
});

test("departmental roles require a matching ProofPoint department membership", () => {
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["manager", "staff"], ["staff"]),
    ["staff"],
  );
});

test("Central admin and director roles remain global", () => {
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["admin", "director"], []),
    ["admin", "director"],
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

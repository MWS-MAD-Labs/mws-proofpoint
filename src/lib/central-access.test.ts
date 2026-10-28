import assert from "node:assert/strict";
import test from "node:test";
import { permissionManifest } from "../../scripts/sync-permissions.mjs";
import {
  CENTRAL_ROLE,
  PROOFPOINT_PERMISSIONS,
  rolesFromCentralEntitlement,
  rolesWithinLocalDepartmentScope,
} from "@/lib/central-access";

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

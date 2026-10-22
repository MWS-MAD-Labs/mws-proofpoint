import assert from "node:assert/strict";
import test from "node:test";
import { permissionManifest } from "../../scripts/sync-permissions.mjs";
import {
  PROOFPOINT_PERMISSIONS,
  rolesFromPermissions,
  rolesWithinLocalDepartmentScope,
} from "@/lib/central-access";

test("the deployment manifest publishes every permission accepted by ProofPoint", () => {
  assert.deepEqual(
    permissionManifest.map(({ key }) => key),
    [...PROOFPOINT_PERMISSIONS],
  );
});

test("Central permissions map only to known ProofPoint roles after app access is granted", () => {
  assert.deepEqual(
    rolesFromPermissions(["proofpoint.access", "proofpoint.manager", "other.permission"]),
    ["manager"],
  );
});

test("a role permission without proofpoint.access grants no ProofPoint role", () => {
  assert.deepEqual(rolesFromPermissions(["proofpoint.admin"]), []);
});

test("multiple Central permissions can grant multiple local role scopes", () => {
  assert.deepEqual(
    rolesFromPermissions(["proofpoint.access", "proofpoint.staff", "proofpoint.supervisor"]),
    ["supervisor", "staff"],
  );
});

test("departmental roles require a matching ProofPoint department membership", () => {
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["manager", "staff"], ["staff"]),
    ["staff"],
  );
});

test("Central admin and director permissions remain global roles", () => {
  assert.deepEqual(
    rolesWithinLocalDepartmentScope(["admin", "director"], []),
    ["admin", "director"],
  );
});

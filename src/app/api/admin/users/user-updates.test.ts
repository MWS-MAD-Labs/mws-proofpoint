import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserProfileUpdate,
  normalizeUserIds,
  validateBulkReactivationStatus,
  validateUserActionTargets,
} from "./user-updates";

test("user profile updates only include personal profile fields", () => {
  assert.deepEqual(buildUserProfileUpdate({}), {
    fullName: undefined,
    niy: undefined,
    jobTitle: undefined,
  });
  assert.deepEqual(buildUserProfileUpdate({ full_name: "A User", job_title: "Teacher" }), {
    fullName: "A User",
    niy: undefined,
    jobTitle: "Teacher",
  });
});

test("bulk user IDs are filtered and deduplicated", () => {
  assert.deepEqual(
    normalizeUserIds(["user-1", "", "user-1", null, "user-2", 3]),
    ["user-1", "user-2"],
  );
  assert.deepEqual(normalizeUserIds(undefined), []);
});

test("bulk status updates only allow reactivation", () => {
  assert.equal(validateBulkReactivationStatus("active"), null);
  assert.deepEqual(validateBulkReactivationStatus("suspended"), {
    error: "Bulk status updates only support reactivation",
    status: 400,
  });
});

test("user action guards reject empty, self, and missing targets", () => {
  assert.deepEqual(validateUserActionTargets([], []), {
    error: "At least one user ID is required",
    status: 400,
  });
  assert.deepEqual(
    validateUserActionTargets(["admin-1", "user-1"], ["admin-1", "user-1"], {
      currentUserId: "admin-1",
      preventSelfAction: true,
    }),
    { error: "You cannot suspend or delete your own account", status: 400 },
  );
  assert.deepEqual(validateUserActionTargets(["user-1", "user-2"], ["user-1"]), {
    error: "One or more selected users no longer exist",
    status: 404,
  });
  assert.equal(validateUserActionTargets(["user-1"], ["user-1"]), null);
});

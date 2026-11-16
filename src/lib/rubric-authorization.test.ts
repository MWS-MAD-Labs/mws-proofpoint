import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateRubric,
  canDeleteRubric,
  canManageRubric,
  canWriteRubricScope,
} from "@/lib/rubric-authorization";

describe("canDeleteRubric", () => {
  it("allows an admin from the effective session roles", () => {
    assert.equal(
      canDeleteRubric({ id: "central-admin", roles: ["admin"] }, "creator"),
      true,
    );
  });

  it("allows an effective admin to manage a system rubric without a creator", () => {
    assert.equal(canManageRubric({ id: "central-admin", roles: ["admin"] }, null), true);
  });

  it("does not preserve a stale local admin grant absent from the session", () => {
    assert.equal(
      canDeleteRubric({ id: "former-admin", roles: ["staff"] }, "creator"),
      false,
    );
  });

  it("allows an eligible rubric creator", () => {
    assert.equal(
      canDeleteRubric({ id: "creator", roles: ["manager"] }, "creator"),
      true,
    );
  });

  it("does not preserve creator mutation access after a role downgrade", () => {
    assert.equal(
      canManageRubric({ id: "creator", roles: ["staff"] }, "creator"),
      false,
    );
  });

  it("allows only effective rubric authoring roles to create templates", () => {
    assert.equal(canCreateRubric({ id: "manager", roles: ["manager"] }), true);
    assert.equal(canCreateRubric({ id: "staff", roles: ["staff"] }), false);
  });

  it("keeps manager-authored rubrics inside the manager's department scope", () => {
    const manager = {
      id: "manager",
      roles: ["manager"],
      departmentIds: ["department-a"],
    };
    assert.equal(canWriteRubricScope(manager, "department-a", false), true);
    assert.equal(canWriteRubricScope(manager, "department-b", false), false);
    assert.equal(canWriteRubricScope(manager, "department-a", true), false);
  });
});

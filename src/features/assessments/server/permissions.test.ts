import assert from "node:assert/strict";
import test from "node:test";
import {
  canRespondToAssessmentQuestion,
  canUpdateLegacyAssessment,
  getAssessmentPermissions,
} from "./permissions";

test("only current privileged assessment actors may answer questions", () => {
  const assessment = { managerId: "manager", directorId: "director" };
  assert.equal(
    canRespondToAssessmentQuestion({ id: "manager", roles: ["manager"] }, assessment),
    true,
  );
  assert.equal(
    canRespondToAssessmentQuestion({ id: "manager", roles: ["staff"] }, assessment),
    false,
  );
  assert.equal(
    canRespondToAssessmentQuestion({ id: "staff", roles: ["staff"] }, assessment),
    false,
  );
});

const managerLed = {
  staffId: "staff",
  managerId: "manager",
  directorId: "director",
  status: "draft",
  workflowSnapshot: {
    steps: [
      { actorRole: "manager", actionType: "FILL_FORM" },
      { actorRole: "director", actionType: "REVIEW" },
      { actorRole: "staff", actionType: "ACKNOWLEDGE" },
    ],
  },
};

test("assigned users need the current effective manager or director role", () => {
  const formerManager = getAssessmentPermissions(
    { id: "manager", roles: ["staff"] },
    managerLed,
  );
  assert.equal(formerManager.canView, false);
  assert.equal(formerManager.canSaveDraft, false);

  const formerDirector = getAssessmentPermissions(
    { id: "director", roles: ["staff"] },
    { ...managerLed, status: "pending_director_review" },
  );
  assert.equal(formerDirector.canView, false);
  assert.equal(formerDirector.canDirectorReview, false);
});

test("legacy assessment updates reject unrelated users and cross-role fields", () => {
  const assessment = {
    staffId: "staff",
    managerId: "manager",
    directorId: "director",
  };
  assert.equal(
    canUpdateLegacyAssessment(
      { id: "unrelated", roles: ["staff"] },
      assessment,
      { staff_scores: {} },
    ),
    false,
  );
  assert.equal(
    canUpdateLegacyAssessment(
      { id: "staff", roles: ["staff"] },
      assessment,
      { manager_scores: {} },
    ),
    false,
  );
  assert.equal(
    canUpdateLegacyAssessment(
      { id: "manager", roles: ["staff"] },
      assessment,
      { manager_scores: {} },
    ),
    false,
  );
});

test("legacy assessment updates allow only the effective actor's fields", () => {
  const assessment = {
    staffId: "staff",
    managerId: "manager",
    directorId: "director",
  };
  assert.equal(
    canUpdateLegacyAssessment(
      { id: "staff", roles: ["staff"] },
      assessment,
      { staff_scores: {}, status: "self_submitted" },
    ),
    true,
  );
  assert.equal(
    canUpdateLegacyAssessment(
      { id: "manager", roles: ["manager"] },
      assessment,
      { manager_scores: {}, status: "manager_reviewed" },
    ),
    true,
  );
});

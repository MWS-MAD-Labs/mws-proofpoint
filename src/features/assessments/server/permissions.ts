import { isManagerLedAssessment } from "./lifecycle";

export function getAssessmentPermissions(
  actor: { id: string; roles: string[] },
  assessment: { staffId: string; managerId: string | null; directorId: string | null; status: string; workflowSnapshot?: unknown },
) {
  const isAdmin = actor.roles.includes("admin");
  const isSubject = actor.id === assessment.staffId;
  const isManager = actor.roles.includes("manager") && actor.id === assessment.managerId;
  const isDirector = actor.roles.includes("director") && (
    actor.id === assessment.directorId || !assessment.directorId
  );
  const managerLed = isManagerLedAssessment(assessment);
  const canView = isAdmin || isSubject || isManager || isDirector;

  return {
    canView,
    canSaveDraft: managerLed && assessment.status === "draft" && (isAdmin || isManager),
    canSubmit: managerLed && assessment.status === "draft" && (isAdmin || isManager),
    canDirectorReview: managerLed && assessment.status === "pending_director_review" && (isAdmin || isDirector),
    canReturn: managerLed && assessment.status === "pending_director_review" && (isAdmin || isDirector),
    canAcknowledge: managerLed && assessment.status === "director_reviewed" && !isAdmin && isSubject,
    isManagerLed: managerLed,
  };
}

const staffUpdateFields = new Set([
  "staff_scores",
  "staff_evidence",
  "staff_notes",
  "staff_submitted_at",
]);
const managerUpdateFields = new Set([
  "manager_scores",
  "manager_evidence",
  "manager_notes",
  "manager_reviewed_at",
  "final_score",
  "final_grade",
]);
const directorUpdateFields = new Set([
  "director_scores",
  "director_evidence",
  "director_comments",
  "director_approved_at",
  "return_feedback",
  "returned_at",
  "returned_by",
  "final_score",
  "final_grade",
]);

export function canUpdateLegacyAssessment(
  actor: { id: string; roles: string[] },
  assessment: { staffId: string; managerId: string | null; directorId: string | null },
  updates: Record<string, unknown>,
): boolean {
  if (actor.roles.includes("admin")) return true;

  const allowedFields = new Set<string>();
  const allowedStatuses = new Set<string>();
  if (actor.id === assessment.staffId) {
    staffUpdateFields.forEach((field) => allowedFields.add(field));
    allowedStatuses.add("self_submitted");
    allowedStatuses.add("acknowledged");
  }
  if (actor.roles.includes("manager") && actor.id === assessment.managerId) {
    managerUpdateFields.forEach((field) => allowedFields.add(field));
    allowedStatuses.add("manager_reviewed");
    allowedStatuses.add("returned");
  }
  if (
    actor.roles.includes("director") &&
    (actor.id === assessment.directorId || !assessment.directorId)
  ) {
    directorUpdateFields.forEach((field) => allowedFields.add(field));
    managerUpdateFields.forEach((field) => allowedFields.add(field));
    allowedStatuses.add("director_approved");
    allowedStatuses.add("returned");
  }

  return Object.entries(updates).every(([field, value]) =>
    field === "status"
      ? typeof value === "string" && allowedStatuses.has(value)
      : allowedFields.has(field),
  );
}

export function canRespondToAssessmentQuestion(
  actor: { id: string; roles: string[] },
  assessment: { managerId: string | null; directorId: string | null },
): boolean {
  return actor.roles.includes("admin") ||
    (actor.roles.includes("manager") && actor.id === assessment.managerId) ||
    (actor.roles.includes("director") && (
      actor.id === assessment.directorId || !assessment.directorId
    ));
}

import { isManagerLedAssessment } from "./lifecycle";

export function getAssessmentPermissions(
  actor: { id: string; roles: string[] },
  assessment: { staffId: string; managerId: string | null; directorId: string | null; status: string; workflowSnapshot?: unknown },
) {
  const isAdmin = actor.roles.includes("admin");
  const isSubject = actor.id === assessment.staffId;
  const isManager = actor.id === assessment.managerId;
  const isDirector = actor.id === assessment.directorId || (actor.roles.includes("director") && !assessment.directorId);
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

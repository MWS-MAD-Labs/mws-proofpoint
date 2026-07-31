export type ManagerLedStatus =
  | "draft"
  | "pending_director_review"
  | "director_reviewed"
  | "acknowledged";

export type AssessmentAction = "save_draft" | "submit" | "director_review" | "return" | "acknowledge";

export function isManagerLedAssessment(assessment: { workflowSnapshot?: unknown; workflow_snapshot?: unknown }) {
  const snapshot = assessment.workflowSnapshot ?? assessment.workflow_snapshot;
  if (!snapshot || typeof snapshot !== "object") return false;
  const steps = (snapshot as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length !== 3) return false;
  const [managerStep, directorStep, staffStep] = steps as Array<{ actorRole?: string; actionType?: string }>;
  return managerStep?.actorRole === "manager"
    && managerStep?.actionType === "FILL_FORM"
    && directorStep?.actorRole === "director"
    && ["REVIEW", "APPROVE"].includes(directorStep?.actionType ?? "")
    && staffStep?.actorRole === "staff"
    && staffStep?.actionType === "ACKNOWLEDGE";
}

export function nextManagerLedTransition(status: string, action: AssessmentAction): ManagerLedStatus | null {
  if (action === "save_draft" && status === "draft") return "draft";
  if (action === "submit" && status === "draft") return "pending_director_review";
  if (action === "director_review" && status === "pending_director_review") return "director_reviewed";
  if (action === "return" && status === "pending_director_review") return "draft";
  if (action === "acknowledge" && status === "director_reviewed") return "acknowledged";
  return null;
}

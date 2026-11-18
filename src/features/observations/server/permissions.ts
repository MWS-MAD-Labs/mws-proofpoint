import type {
  ObservationAccessRecord,
  ObservationActor,
  ObservationPermissions,
} from "../types";
import { normalizeObservationStatus } from "./lifecycle";

function hasRole(actor: ObservationActor, role: string): boolean {
  return actor.roles.includes(role);
}

export function getObservationPermissions(
  actor: ObservationActor,
  observation: ObservationAccessRecord,
): ObservationPermissions {
  const status = normalizeObservationStatus(observation.status);
  const isAdmin = hasRole(actor, "admin");
  // The assigned observer is a manager or instructional coach who created
  // (or was reassigned) the observation.
  const isAssignedManager =
    (hasRole(actor, "manager") || hasRole(actor, "instructional_coach")) &&
    observation.managerId === actor.id;
  // Directors and instructional coaches oversee every observation.
  const isDirector =
    hasRole(actor, "director") || hasRole(actor, "instructional_coach");
  const isParticipant =
    observation.isParticipant ?? observation.staffId === actor.id;
  const hasPendingAcknowledgement =
    isParticipant && observation.participantAcknowledgedAt == null;

  // Participants must not learn that an observer's draft exists.
  // A separate privileged role (admin, director, instructional coach, or
  // assigned observer) retains access.
  const canViewRecord =
    isAdmin ||
    isAssignedManager ||
    isDirector ||
    (isParticipant && status !== "draft");
  const canViewResponses =
    isAdmin ||
    isAssignedManager ||
    ((isDirector || isParticipant) && status !== "draft");

  return {
    canViewRecord,
    canViewResponses,
    canEdit: status === "draft" && (isAdmin || isAssignedManager),
    canSubmit: status === "draft" && (isAdmin || isAssignedManager),
    canAcknowledge:
      !isAdmin && hasPendingAcknowledgement && status === "submitted",
    canReopen:
      isAdmin && (status === "submitted" || status === "acknowledged"),
    canReassign: isAdmin,
    canDelete: status !== "acknowledged" && (isAdmin || isAssignedManager),
  };
}

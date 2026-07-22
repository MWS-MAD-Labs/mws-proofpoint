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
  const isAssignedManager = observation.managerId === actor.id;
  const isDirector = hasRole(actor, "director");
  const isSubjectStaff = observation.staffId === actor.id;

  const canViewRecord =
    isAdmin || isAssignedManager || isDirector || isSubjectStaff;
  const canViewResponses =
    isAdmin ||
    isAssignedManager ||
    ((isDirector || isSubjectStaff) && status !== "draft");

  return {
    canViewRecord,
    canViewResponses,
    canEdit: status === "draft" && (isAdmin || isAssignedManager),
    canSubmit: status === "draft" && (isAdmin || isAssignedManager),
    canAcknowledge:
      !isAdmin && isSubjectStaff && status === "submitted",
    canReopen:
      isAdmin && (status === "submitted" || status === "acknowledged"),
    canReassign: isAdmin,
    canDelete: status !== "acknowledged" && (isAdmin || isAssignedManager),
  };
}

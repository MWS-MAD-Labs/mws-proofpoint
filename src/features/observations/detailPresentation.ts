import type {
  ObservationActivityEntry,
  ObservationAcknowledgementProgress,
  ObservationDetail,
  ObservationParticipantDetail,
  ObservationPermissions,
  ObservationStatus,
} from "./types";

export type ObservationPrimaryAction = "edit" | "acknowledge" | "reopen" | null;

export function getObservationDetailParticipants(
  observation: Pick<ObservationDetail, "participants" | "staff">,
): ObservationParticipantDetail[] {
  if (observation.participants?.length) return observation.participants;
  if (!observation.staff) return [];
  return [
    {
      id: observation.staff.id,
      email: observation.staff.email,
      fullName: observation.staff.profile.fullName,
      department: observation.staff.profile.department ?? null,
      acknowledgedAt: null,
      acknowledgementMethod: null,
      acknowledgementResponse: null,
      acknowledgementNote: null,
      acknowledgementResponseVisible: false,
    },
  ];
}

export function getObservationAcknowledgementProgress(
  observation: Pick<
    ObservationDetail,
    "acknowledgementProgress" | "participants" | "staff" | "status" | "acknowledgedAt"
  >,
): ObservationAcknowledgementProgress {
  if (observation.acknowledgementProgress) {
    return observation.acknowledgementProgress;
  }
  const participants = getObservationDetailParticipants(observation);
  const total = participants.length;
  const acknowledged = observation.participants?.length
    ? participants.filter((participant) => participant.acknowledgedAt).length
    : observation.status === "acknowledged" || Boolean(observation.acknowledgedAt)
      ? total
      : 0;
  return {
    acknowledged,
    total,
    pending: Math.max(total - acknowledged, 0),
    percentage: total > 0 ? Math.round((acknowledged / total) * 100) : 0,
  };
}

export function getObservationPrimaryAction(
  permissions: ObservationPermissions,
): ObservationPrimaryAction {
  if (permissions.canAcknowledge) return "acknowledge";
  if (permissions.canEdit) return "edit";
  if (permissions.canReopen) return "reopen";
  return null;
}

export function shouldShowObservationResponses(
  permissions: ObservationPermissions,
): boolean {
  return permissions.canViewResponses;
}

export function sortObservationActivity(
  activity: readonly ObservationActivityEntry[],
): ObservationActivityEntry[] {
  return [...activity].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function getObservationStageTimestamp(
  observation: Pick<
    ObservationDetail,
    "status" | "createdAt" | "reopenedAt" | "submittedAt" | "acknowledgedAt"
  >,
  stage: ObservationStatus,
): string | null {
  if (stage === "draft") return observation.reopenedAt ?? observation.createdAt;
  if (stage === "submitted") return observation.submittedAt;
  return observation.acknowledgedAt;
}

export function getObservationStageActivity(
  activity: readonly ObservationActivityEntry[],
  stage: ObservationStatus,
): ObservationActivityEntry | null {
  const eventType =
    stage === "draft"
      ? "created"
      : stage === "submitted"
        ? "submitted"
        : "acknowledged";
  const matches = activity.filter(
    (entry) => entry.eventType === eventType || entry.statusTo === stage,
  );
  return (
    [...matches].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )[0] ?? null
  );
}

export function getObservationAgeStart(
  observation: Pick<
    ObservationDetail,
    "status" | "createdAt" | "reopenedAt" | "submittedAt" | "acknowledgedAt"
  >,
): string {
  return (
    getObservationStageTimestamp(observation, observation.status) ??
    observation.createdAt
  );
}

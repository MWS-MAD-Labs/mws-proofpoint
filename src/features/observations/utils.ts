import { format, formatDistanceToNowStrict } from "date-fns";
import type {
  ObservationListItem,
  ObservationParticipantSummary,
  ObservationScope,
  ObservationStatus,
} from "./types";

export function personName(person: { email: string; fullName: string | null } | null): string {
  if (!person) return "Unassigned";
  return person.fullName?.trim() || person.email;
}

export function personFirstName(person: { email: string; fullName: string | null }): string {
  const fullName = person.fullName?.trim();
  if (fullName) return fullName.split(/\s+/)[0];
  return person.email.split("@")[0] || person.email;
}

export function observationParticipants(
  item: Pick<ObservationListItem, "participants" | "staff">,
): ObservationParticipantSummary[] {
  if (item.participants.length > 0) return item.participants;
  return [
    {
      ...item.staff,
      department: null,
      acknowledgedAt: null,
      acknowledgementMethod: null,
    },
  ];
}

export function participantSummary(
  participants: readonly { email: string; fullName: string | null }[],
  visibleNames = 2,
): string {
  if (participants.length === 0) return "No participants";
  const shown = participants.slice(0, visibleNames).map(personFirstName);
  const remaining = participants.length - shown.length;
  return `${shown.join(", ")}${remaining > 0 ? ` +${remaining}` : ""}`;
}

export function participantLabel(count: number): string {
  return count === 1 ? "Observed teacher" : "Observed teachers";
}

export function participantDepartmentSummary(
  participants: readonly { department?: { name: string } | null }[],
  fallback?: { name: string } | null,
): string {
  const departments = Array.from(
    new Set(
      participants
        .map((participant) => participant.department?.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  );
  if (departments.length === 0) return fallback?.name || "Not assigned";
  if (departments.length === 1) return departments[0];
  return `${departments.length} departments`;
}

export function observationScopeLabel(scope: ObservationScope | undefined): string {
  if (!scope) return "Individual";
  if (scope.type === "CLASS") return scope.className?.trim() || "Class";
  if (scope.type === "SUBJECT") return scope.subjectName?.trim() || "Subject";
  return "Individual";
}

export function observationScopeTypeLabel(scope: ObservationScope | undefined): string {
  if (scope?.type === "CLASS") return "Class";
  if (scope?.type === "SUBJECT") return "Subject";
  return "Individual";
}

export function observationScopeSummary(scope: ObservationScope | undefined): string {
  const type = observationScopeTypeLabel(scope);
  if (type === "Individual") return "Individual observation";
  return `${type}: ${observationScopeLabel(scope)}`;
}

export function utcDateValue(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatObservationDate(value: string | null): string {
  return value
    ? format(new Date(`${value.slice(0, 10)}T12:00:00`), "d MMM yyyy")
    : "Not scheduled";
}

export function formatExactDate(value: string): string {
  return format(new Date(value), "d MMM yyyy, h:mm a");
}

export function formatRelativeDate(value: string): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function observationTitle(item: ObservationListItem): string {
  return item.title?.trim() || item.rubric.name;
}

export function observationHref(item: Pick<ObservationListItem, "id">): string {
  return `/observations/${item.id}`;
}

export function observationActionLabel(item: Pick<ObservationListItem, "nextAction">): string {
  switch (item.nextAction) {
    case "continue":
      return "Continue";
    case "acknowledge":
      return "Review & acknowledge";
    case "follow_up":
      return "Follow up";
    default:
      return "View";
  }
}

export function statusStage(status: ObservationStatus): string {
  if (status === "submitted") return "Awaiting acknowledgement";
  if (status === "acknowledged") return "Complete";
  return "In progress";
}

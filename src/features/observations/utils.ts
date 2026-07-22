import { format, formatDistanceToNowStrict } from "date-fns";
import type { ObservationListItem, ObservationStatus } from "./types";

export function personName(person: { email: string; fullName: string | null } | null): string {
  if (!person) return "Unassigned";
  return person.fullName?.trim() || person.email;
}

export function formatObservationDate(value: string | null): string {
  return value ? format(new Date(value), "d MMM yyyy") : "Not scheduled";
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
  if (status === "submitted") return "Ready for staff review";
  if (status === "acknowledged") return "Complete";
  return "In progress";
}

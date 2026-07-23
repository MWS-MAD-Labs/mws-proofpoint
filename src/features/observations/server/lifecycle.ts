import type {
  ObservationStatus,
  ObservationStatusInput,
} from "../types";

export const observationTransitions = {
  draft: ["submitted"],
  submitted: ["acknowledged", "draft"],
  acknowledged: ["draft"],
} as const satisfies Record<ObservationStatus, readonly ObservationStatus[]>;

export function normalizeObservationStatus(
  status: ObservationStatusInput,
  acknowledgedAt?: Date | string | null,
): ObservationStatus {
  if (status === "pending") return "draft";
  if (status === "reviewed") {
    return acknowledgedAt ? "acknowledged" : "submitted";
  }
  return status;
}

export function canTransitionObservation(
  from: ObservationStatus,
  to: ObservationStatus,
): boolean {
  return (observationTransitions[from] as readonly ObservationStatus[]).includes(
    to,
  );
}

export function assertObservationTransition(
  from: ObservationStatus,
  to: ObservationStatus,
): void {
  if (!canTransitionObservation(from, to)) {
    throw new Error(`Invalid observation transition: ${from} -> ${to}`);
  }
}

import type { ObservationStatus } from "./types";

export const OBSERVATION_STATUS: Record<
  ObservationStatus,
  { label: string; description: string; className: string }
> = {
  draft: {
    label: "Draft",
    description: "Manager is completing the observation",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  submitted: {
    label: "Awaiting acknowledgement",
    description: "Staff review is required",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  acknowledged: {
    label: "Completed",
    description: "Staff has acknowledged the observation",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export const OBSERVATION_SORT_OPTIONS = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Oldest updated" },
  { value: "created_desc", label: "Recently created" },
  { value: "created_asc", label: "Oldest created" },
  { value: "due_asc", label: "Due soonest" },
  { value: "due_desc", label: "Due latest" },
] as const;

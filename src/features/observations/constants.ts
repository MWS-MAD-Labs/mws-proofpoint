import type { ObservationStatus } from "./types";

export const OBSERVATION_STATUS: Record<
  ObservationStatus,
  { label: string; description: string; className: string }
> = {
  draft: {
    label: "Draft",
    description: "Manager is completing the observation",
    className: "border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning-foreground",
  },
  submitted: {
    label: "Awaiting acknowledgement",
    description: "Staff review is required",
    className: "border-primary/30 bg-primary/10 text-primary dark:text-primary",
  },
  acknowledged: {
    label: "Completed",
    description: "Staff has acknowledged the observation",
    className: "border-success/30 bg-success/10 text-success dark:text-success",
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

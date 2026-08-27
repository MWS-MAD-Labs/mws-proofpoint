import type { ObservationListQuery } from "../schemas";

export const observationKeys = {
  all: ["observations"] as const,
  lists: () => [...observationKeys.all, "list"] as const,
  list: (filters: ObservationListQuery) => [...observationKeys.lists(), filters] as const,
  summary: () => [...observationKeys.all, "summary"] as const,
  detail: (id: string) => [...observationKeys.all, "detail", id] as const,
  filterOptions: () => [...observationKeys.all, "filter-options"] as const,
  creationStaff: () => [...observationKeys.all, "creation-staff"] as const,
  creationForms: () => [...observationKeys.all, "creation-forms"] as const,
  creationFormsFor: (staffIds: string[]) =>
    [...observationKeys.creationForms(), [...staffIds].sort()] as const,
};

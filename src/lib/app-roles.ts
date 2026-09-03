export const GLOBAL_ROLES = ["admin", "director"] as const;
export const DEPARTMENTAL_ROLES = ["manager", "supervisor", "staff"] as const;
export const MANAGEABLE_ROLES = [...GLOBAL_ROLES, ...DEPARTMENTAL_ROLES] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];
export type DepartmentalRole = (typeof DEPARTMENTAL_ROLES)[number];
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export function isGlobalRole(role: string): role is GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}

export function isDepartmentalRole(role: string): role is DepartmentalRole {
  return (DEPARTMENTAL_ROLES as readonly string[]).includes(role);
}

export function isManageableRole(role: string): role is ManageableRole {
  return (MANAGEABLE_ROLES as readonly string[]).includes(role);
}

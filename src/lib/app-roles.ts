export const GLOBAL_ROLES = ["admin", "director"] as const;
export const DEPARTMENTAL_ROLES = ["manager", "supervisor", "staff"] as const;
export const MANAGEABLE_ROLES = [...GLOBAL_ROLES, ...DEPARTMENTAL_ROLES] as const;

// Central-only roles are granted through the Central entitlement and are never
// stored as local department role assignments.
export const INSTRUCTIONAL_COACH_ROLE = "instructional_coach" as const;
export const CENTRAL_ONLY_ROLES = [INSTRUCTIONAL_COACH_ROLE] as const;
export const SESSION_ROLES = [...MANAGEABLE_ROLES, ...CENTRAL_ONLY_ROLES] as const;

// Roles that may create and conduct observations. Unscoped observers may
// observe staff in every department; managers only observe their department.
export const OBSERVER_ROLES = ["admin", "manager", INSTRUCTIONAL_COACH_ROLE] as const;
export const UNSCOPED_OBSERVER_ROLES = ["admin", INSTRUCTIONAL_COACH_ROLE] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];
export type DepartmentalRole = (typeof DEPARTMENTAL_ROLES)[number];
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];
export type SessionRole = (typeof SESSION_ROLES)[number];

export function isGlobalRole(role: string): role is GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}

export function isDepartmentalRole(role: string): role is DepartmentalRole {
  return (DEPARTMENTAL_ROLES as readonly string[]).includes(role);
}

export function isManageableRole(role: string): role is ManageableRole {
  return (MANAGEABLE_ROLES as readonly string[]).includes(role);
}

export function isSessionRole(role: string): role is SessionRole {
  return (SESSION_ROLES as readonly string[]).includes(role);
}

export function canObserve(roles: readonly string[]): boolean {
  return roles.some((role) => (OBSERVER_ROLES as readonly string[]).includes(role));
}

export function canObserveAnyStaff(roles: readonly string[]): boolean {
  return roles.some((role) => (UNSCOPED_OBSERVER_ROLES as readonly string[]).includes(role));
}

export function canViewAllObservations(roles: readonly string[]): boolean {
  return roles.some((role) => role === "admin" || role === "director" || role === INSTRUCTIONAL_COACH_ROLE);
}

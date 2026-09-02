export interface UserActionValidationError {
  error: string;
  status: 400 | 404;
}

export function normalizeUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export function validateBulkReactivationStatus(status: unknown): UserActionValidationError | null {
  return status === "active"
    ? null
    : { error: "Bulk status updates only support reactivation", status: 400 };
}

export function validateUserActionTargets(
  requestedIds: string[],
  existingIds: string[],
  options: { currentUserId?: string; preventSelfAction?: boolean } = {},
): UserActionValidationError | null {
  if (requestedIds.length === 0) {
    return { error: "At least one user ID is required", status: 400 };
  }
  if (options.preventSelfAction && options.currentUserId && requestedIds.includes(options.currentUserId)) {
    return { error: "You cannot suspend or delete your own account", status: 400 };
  }
  if (existingIds.length !== requestedIds.length) {
    return { error: "One or more selected users no longer exist", status: 404 };
  }
  return null;
}

export interface UserProfileUpdateInput {
  full_name?: string | null;
  niy?: string | null;
  job_title?: string | null;
  department_id?: string | null;
}

export function buildUserProfileUpdate(input: UserProfileUpdateInput) {
  const { full_name, niy, job_title, department_id } = input;
  const departmentId = department_id === "" || department_id === "none"
    ? null
    : department_id;

  return {
    fullName: full_name ?? undefined,
    niy: niy ?? undefined,
    jobTitle: job_title ?? undefined,
    departmentId: department_id === undefined ? undefined : departmentId,
  };
}

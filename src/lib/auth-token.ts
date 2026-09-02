export interface RefreshableAuthToken {
  id?: unknown;
  email?: unknown;
  roles?: string[];
  departmentId?: string | null;
}

export interface ActiveAuthUser {
  id: string;
  roles: string[] | null;
  departmentId: string | null;
}

export async function refreshAuthToken<T extends RefreshableAuthToken>(
  token: T,
  findActiveUser: () => Promise<ActiveAuthUser | null>,
  onLookupError: (error: unknown) => void = () => undefined,
): Promise<T | null> {
  let user: ActiveAuthUser | null;
  try {
    user = await findActiveUser();
  } catch (error) {
    onLookupError(error);
    return token;
  }

  if (!user) return null;

  token.id = user.id;
  token.roles = user.roles ?? [];
  token.departmentId = user.departmentId;
  return token;
}

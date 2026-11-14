function value(name: string): string | null {
  return process.env[name]?.trim() || null;
}

export function centralApiBase(): string | null {
  const base = value("CENTRAL_API_BASE_URL");
  if (!base) return null;
  const normalized = base.replace(/\/+$/, "");
  return normalized.endsWith("/api/internal")
    ? normalized
    : `${normalized}/api/internal`;
}

export function centralApiToken(): string | null {
  return value("CENTRAL_API_TOKEN");
}

export function centralOrganizationId(): string | null {
  return value("CENTRAL_ORGANIZATION_ID");
}

export function centralAuthHeaders(token: string): Record<string, string> {
  const organizationId = centralOrganizationId();
  return {
    authorization: `Bearer ${token}`,
    ...(organizationId ? { "x-central-organization-id": organizationId } : {}),
  };
}

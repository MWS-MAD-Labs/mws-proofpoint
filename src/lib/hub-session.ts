import { createHubSession } from "mws-central-auth/server";

export function isHubAuthEnabled(): boolean {
  return process.env.PROOFPOINT_AUTH_MODE?.trim().toLowerCase() === "hub";
}

export function hubSession() {
  const base = process.env.HUB_BASE_URL?.trim();
  if (!base) throw new Error("HUB_BASE_URL is not configured");
  return createHubSession({
    hubBaseUrl: base,
    audience: process.env.HUB_ACCESS_AUDIENCE?.trim() || "mws-apps",
    cookieName: process.env.HUB_ACCESS_COOKIE_NAME?.trim() || undefined,
  });
}

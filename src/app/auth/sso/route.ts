import { NextRequest, NextResponse } from "next/server";
import { applicationUrl } from "@/lib/application-url";
import { resolveHubSession } from "@/lib/hub-auth";
import { hubSession, isHubAuthEnabled } from "@/lib/hub-session";

export async function GET(request: NextRequest) {
  if (!isHubAuthEnabled()) {
    return NextResponse.redirect(applicationUrl("/auth", request.url));
  }

  const hub = hubSession();
  try {
    const session = await resolveHubSession(request.headers.get("cookie"));
    if (session) {
      return NextResponse.redirect(applicationUrl("/dashboard", request.url));
    }
  } catch (error) {
    console.error(
      "[hub-auth] Could not resolve the Hub session",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.redirect(
      applicationUrl("/auth?error=upstream_unavailable", request.url),
    );
  }

  const claims = await hub.fromCookieHeader(request.headers.get("cookie"));
  if (claims) {
    return NextResponse.redirect(
      applicationUrl("/auth?error=no_access", request.url),
    );
  }

  const here = applicationUrl("/auth/sso", request.url).toString();
  const step = hub.step({
    claims: null,
    restored: request.nextUrl.searchParams.has("restored"),
  });
  return NextResponse.redirect(
    step === "restore" ? hub.restoreUrl(here) : hub.homeUrl(),
  );
}

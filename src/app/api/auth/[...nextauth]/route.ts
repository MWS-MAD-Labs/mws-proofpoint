import { NextRequest, NextResponse } from "next/server";
import { auth, handlers } from "@/lib/auth";
import { isHubAuthEnabled } from "@/lib/hub-session";

export async function GET(request: NextRequest) {
  if (!isHubAuthEnabled()) return handlers.GET(request);

  if (new URL(request.url).pathname !== "/api/auth/session") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    return NextResponse.json(await auth(), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    console.error("[hub-auth] Session lookup failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isHubAuthEnabled()) return handlers.POST(request);
  return NextResponse.json({ error: "Local authentication is disabled" }, { status: 410 });
}

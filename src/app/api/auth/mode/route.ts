import { NextResponse } from "next/server";
import { hubSession, isHubAuthEnabled } from "@/lib/hub-session";

export function GET() {
  const hubEnabled = isHubAuthEnabled();
  return NextResponse.json({
    mode: hubEnabled ? "hub" : "nextauth",
    ...(hubEnabled ? { refreshUrl: hubSession().refreshUrl() } : {}),
  }, { headers: { "cache-control": "no-store" } });
}

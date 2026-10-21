import { NextRequest, NextResponse } from "next/server";
import { hubSession, isHubAuthEnabled } from "@/lib/hub-session";

export function GET(request: NextRequest) {
  if (!isHubAuthEnabled()) return NextResponse.redirect(new URL("/auth", request.url));
  return NextResponse.redirect(hubSession().homeUrl());
}

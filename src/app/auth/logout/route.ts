import { NextRequest, NextResponse } from "next/server";
import { applicationUrl } from "@/lib/application-url";
import { hubSession, isHubAuthEnabled } from "@/lib/hub-session";

export function GET(request: NextRequest) {
  if (!isHubAuthEnabled()) return NextResponse.redirect(applicationUrl("/auth", request.url));
  return NextResponse.redirect(hubSession().homeUrl());
}

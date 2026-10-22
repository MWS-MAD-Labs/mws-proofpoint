import { NextRequest, NextResponse } from "next/server";
import { applicationUrl } from "@/lib/application-url";

export function GET(request: NextRequest) {
  const target = applicationUrl("/auth/sso", request.url);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target);
}

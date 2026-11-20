import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { centralManagesDepartments, getCentralSyncStatus, runCentralSync } from "@/lib/central-sync";
import { isHubAuthEnabled } from "@/lib/hub-session";

export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;
  return NextResponse.json(
    { enabled: isHubAuthEnabled(), managesDepartments: centralManagesDepartments(), ...getCentralSyncStatus() },
    { headers: { "cache-control": "no-store" } },
  );
}

// Sync now: reads Central in full, regardless of whether anything changed.
export async function POST() {
  const { response } = await requireRole("admin");
  if (response) return response;
  if (!isHubAuthEnabled()) {
    return NextResponse.json({ error: "Central sync runs only in Hub sign-in mode." }, { status: 409 });
  }

  const result = await runCentralSync({ force: true });
  if (result.status === "locked") {
    return NextResponse.json({ error: "A sync is already running. Try again in a moment." }, { status: 409 });
  }
  if (result.status === "error") {
    return NextResponse.json(
      { error: result.message, managesDepartments: centralManagesDepartments(), ...getCentralSyncStatus() },
      { status: 502 },
    );
  }
  return NextResponse.json({ result, managesDepartments: centralManagesDepartments(), ...getCentralSyncStatus() });
}

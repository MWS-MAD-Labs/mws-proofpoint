// src/app/api/managers/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findLocalUsersWithEffectiveRoles } from "@/lib/effective-user-access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const managers = await findLocalUsersWithEffectiveRoles(["manager", "admin", "instructional_coach"]);

    // Format to match expected shape { id, email, profile: { fullName } }
    const formatted = managers.map((m) => ({
      id:      m.id,
      email:   m.email,
      profile: { fullName: m.fullName },
    }));

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/managers error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// src/app/api/managers/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const managers = await query(
      `SELECT DISTINCT
         u.id,
         u.email,
         p.full_name as "fullName"
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE ur.role IN ('manager', 'admin')
         AND u.status = 'active'
       ORDER BY u.email ASC`
    ) as any[];

    // Format to match expected shape { id, email, profile: { fullName } }
    const formatted = managers.map((m) => ({
      id:      m.id,
      email:   m.email,
      profile: { fullName: m.fullName ?? null },
    }));

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/managers error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
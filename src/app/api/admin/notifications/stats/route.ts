import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes("admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await query(`
      SELECT
        status,
        type,
        COUNT(*) as count
      FROM notifications
      GROUP BY status, type
      ORDER BY status, type
    `);

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error("Notification stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}

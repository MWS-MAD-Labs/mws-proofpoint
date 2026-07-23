import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { query } from "@/lib/db";
import type { ObservationCreationStaff } from "@/features/observations/types";

interface StaffRow {
  id: string;
  email: string;
  fullName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roles: string[] | null;
}

export async function GET() {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const staff = await query<StaffRow>(
      `SELECT
         u.id,
         u.email,
         p.full_name AS "fullName",
         p.department_id AS "departmentId",
         d.name AS "departmentName",
         array_agg(DISTINCT all_roles.role::text ORDER BY all_roles.role::text)
           FILTER (WHERE all_roles.role IS NOT NULL) AS roles
       FROM users u
       JOIN user_roles staff_role
         ON staff_role.user_id = u.id AND staff_role.role = 'staff'
       LEFT JOIN user_roles all_roles ON all_roles.user_id = u.id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN departments d ON d.id = p.department_id
       WHERE u.status = 'active'
         AND ($1::boolean = true OR p.department_id = (
           SELECT department_id FROM profiles WHERE user_id = $2
         ))
         AND ($1::boolean = true OR u.id <> $2)
       GROUP BY u.id, u.email, p.full_name, p.department_id, d.name
       ORDER BY p.full_name ASC NULLS LAST, u.email ASC`,
      [isAdmin, session.user.id],
    );

    const response: ObservationCreationStaff[] = staff.map((person) => ({
      id: person.id,
      email: person.email,
      fullName: person.fullName,
      department: person.departmentId
        ? { id: person.departmentId, name: person.departmentName ?? "Unassigned" }
        : null,
      roles: person.roles ?? ["staff"],
    }));
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/staff error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

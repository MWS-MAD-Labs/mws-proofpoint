// src/app/api/observations/staff/route.ts
// Manager/admin-safe staff lookup for creating observations.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as any).roles ?? [];
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");

    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params: string[] = [];
    let assignmentFilter = "";

    if (!isAdmin) {
      assignmentFilter = `AND EXISTS (
        SELECT 1
          FROM department_role_memberships staff_membership
          JOIN department_roles staff_role
            ON staff_role.id = staff_membership.department_role_id
           AND staff_role.role::text = 'staff'
          JOIN department_role_memberships manager_membership
            ON manager_membership.department_role_id IN (
              SELECT manager_role.id
                FROM department_roles manager_role
               WHERE manager_role.department_id = staff_role.department_id
                 AND manager_role.role::text = 'manager'
            )
         WHERE staff_membership.user_id = u.id
           AND manager_membership.user_id = $1
      )`;
      params.push(session.user.id);
    }

    const staff = await query(
      `SELECT DISTINCT
         u.id,
         u.email,
         p.full_name as "fullName"
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role::text = 'staff'
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.status = 'active'
         ${assignmentFilter}
       ORDER BY p.full_name ASC NULLS LAST, u.email ASC`,
      params
    ) as any[];

    return NextResponse.json(staff.map((s) => ({
      id: s.id,
      email: s.email,
      profile: { fullName: s.fullName ?? null },
    })));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/staff error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

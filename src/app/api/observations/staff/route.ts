import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { query } from "@/lib/db";
import { managerStaffScopeExistsSql } from "@/lib/organization-access";
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
         staff_department.department_id::text AS "departmentId",
         staff_department.department_name AS "departmentName",
         COALESCE((
           SELECT array_agg(DISTINCT assigned_role.role::text ORDER BY assigned_role.role::text)
             FROM department_role_memberships assigned_membership
             JOIN department_roles assigned_role ON assigned_role.id = assigned_membership.department_role_id
            WHERE assigned_membership.user_id = u.id
         ), ARRAY[]::text[]) AS roles
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       JOIN LATERAL (
         SELECT staff_role.department_id, d.name AS department_name
           FROM department_role_memberships staff_membership
           JOIN department_roles staff_role ON staff_role.id = staff_membership.department_role_id
           JOIN departments d ON d.id = staff_role.department_id
          WHERE staff_membership.user_id = u.id
            AND staff_role.role::text = 'staff'
            AND ($1::boolean = true OR ${managerStaffScopeExistsSql("u.id", "$2")})
          ORDER BY d.name, staff_role.department_id
          LIMIT 1
       ) staff_department ON true
       WHERE u.status = 'active'
         AND ($1::boolean = true OR u.id <> $2)
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

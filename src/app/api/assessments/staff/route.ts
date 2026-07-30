import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
  if (!roles.includes("manager") && !roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const staff = await query(
    `WITH eligible_staff AS (
       SELECT DISTINCT ON (u.id)
              u.id,
              u.email,
              p.full_name AS "fullName",
              dr.department_id AS "departmentId"
         FROM users u
         JOIN department_role_memberships staff_membership
           ON staff_membership.user_id = u.id
         JOIN department_roles dr
           ON dr.id = staff_membership.department_role_id
          AND dr.role = 'staff'
          AND dr.department_id IS NOT NULL
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.status = 'active'
          AND (
            $1::boolean
            OR EXISTS (
              SELECT 1
                FROM department_role_memberships manager_membership
                JOIN department_roles manager_role
                  ON manager_role.id = manager_membership.department_role_id
                 AND manager_role.role = 'manager'
               WHERE manager_membership.user_id = $2
                 AND manager_role.department_id = dr.department_id
            )
          )
        ORDER BY u.id, dr.department_id
     )
     SELECT * FROM eligible_staff
     ORDER BY "fullName" NULLS LAST, email`, 
    [roles.includes("admin"), session.user.id],
  );
  return NextResponse.json({ data: staff });
}

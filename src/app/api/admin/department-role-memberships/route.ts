import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { rebuildUserRoleProjection } from "@/lib/organization-access";

const MANAGEABLE_ROLES = new Set(["admin", "director", "manager", "supervisor", "staff"]);

interface AssignmentRow {
  departmentRoleId: string;
  departmentId: string | null;
  departmentName: string | null;
  role: string;
  userId: string;
  email: string;
  fullName: string | null;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 as const };
  }
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("admin")) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { session };
}

function serializeAssignments(rows: AssignmentRow[]) {
  const roles = new Map<
    string,
    {
      department_role_id: string;
      department_id: string | null;
      department_name: string | null;
      role: string;
      assignees: Array<{ user_id: string; email: string; full_name: string | null }>;
    }
  >();

  for (const row of rows) {
    const current = roles.get(row.departmentRoleId) ?? {
      department_role_id: row.departmentRoleId,
      department_id: row.departmentId,
      department_name: row.departmentName,
      role: row.role,
      assignees: [],
    };
    if (row.userId) {
      current.assignees.push({
        user_id: row.userId,
        email: row.email,
        full_name: row.fullName,
      });
    }
    roles.set(row.departmentRoleId, current);
  }

  return Array.from(roles.values());
}

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const rows = await query<AssignmentRow>(
      `SELECT dr.id::text AS "departmentRoleId",
              dr.department_id::text AS "departmentId",
              d.name AS "departmentName",
              dr.role::text AS role,
              u.id::text AS "userId",
              u.email,
              p.full_name AS "fullName"
         FROM department_roles dr
         LEFT JOIN departments d ON d.id = dr.department_id
         LEFT JOIN department_role_memberships drm ON drm.department_role_id = dr.id
         LEFT JOIN users u ON u.id = drm.user_id AND u.status <> 'deleted'
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE (dr.department_id IS NOT NULL AND dr.role::text IN ('manager', 'supervisor', 'staff'))
           OR (dr.department_id IS NULL AND dr.role::text IN ('director', 'admin'))
        ORDER BY d.name NULLS FIRST, dr.role, p.full_name NULLS LAST, u.email`,
    );

    return NextResponse.json({ data: serializeAssignments(rows) });
  } catch (error) {
    console.error("Department role memberships GET error:", error);
    return NextResponse.json(
      { error: "Failed to load role assignments." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const body = (await request.json()) as {
      department_role_id?: unknown;
      user_ids?: unknown;
    };
    const departmentRoleId = String(body.department_role_id ?? "").trim();
    const userIds = Array.isArray(body.user_ids)
      ? Array.from(new Set(body.user_ids.map(String).map((id) => id.trim()).filter(Boolean)))
      : null;

    if (!departmentRoleId || !userIds) {
      return NextResponse.json(
        { error: "department_role_id and user_ids are required." },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const roleResult = await client.query<{
        id: string;
        role: string;
        departmentId: string | null;
      }>(
        `SELECT id::text, role::text AS role, department_id::text AS "departmentId"
           FROM department_roles
          WHERE id::text = $1
          FOR UPDATE`,
        [departmentRoleId],
      );
      const role = roleResult.rows[0];
      if (!role || !MANAGEABLE_ROLES.has(role.role)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Role assignment not found." }, { status: 404 });
      }
      if (role.departmentId === null && !["admin", "director"].includes(role.role)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This global role cannot be managed here." }, { status: 400 });
      }
      if (role.departmentId !== null && !["manager", "supervisor", "staff"].includes(role.role)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This department role cannot be managed here." }, { status: 400 });
      }
      if (role.role === "admin" && userIds.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "At least one global admin is required." },
          { status: 400 },
        );
      }

      if (userIds.length > 0) {
        const usersResult = await client.query<{ id: string }>(
          `SELECT id::text AS id
             FROM users
            WHERE id::text = ANY($1::text[])
              AND status <> 'deleted'`,
          [userIds],
        );
        if (usersResult.rows.length !== userIds.length) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "One or more selected users are deleted or unavailable." },
            { status: 400 },
          );
        }
      }

      const previousResult = await client.query<{ userId: string }>(
        `SELECT user_id::text AS "userId"
           FROM department_role_memberships
          WHERE department_role_id::text = $1`,
        [departmentRoleId],
      );
      const previousUserIds = previousResult.rows.map((row) => row.userId);

      await client.query(
        `DELETE FROM department_role_memberships WHERE department_role_id::text = $1`,
        [departmentRoleId],
      );

      for (const userId of userIds) {
        await client.query(
          `INSERT INTO department_role_memberships
             (id, department_role_id, user_id, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [randomUUID(), departmentRoleId, userId],
        );
      }

      const affectedUserIds = Array.from(new Set([...previousUserIds, ...userIds]));
      await rebuildUserRoleProjection(client, affectedUserIds);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ data: { department_role_id: departmentRoleId, user_ids: userIds } });
  } catch (error) {
    console.error("Department role memberships PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update role assignments." },
      { status: 500 },
    );
  }
}

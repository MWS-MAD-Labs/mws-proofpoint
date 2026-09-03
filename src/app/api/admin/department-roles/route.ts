import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool, query, queryOne } from "@/lib/db";
import {
    canonicalRoleScopeSql,
    isCanonicalRoleAssignment,
    rebuildUserRoleProjection,
} from "@/lib/organization-access";

// Helper to check if user is admin
async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized", status: 401 };
    }
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!roles.includes("admin")) {
        return { error: "Forbidden", status: 403 };
    }
    return { session };
}

// GET /api/admin/department-roles - Get department role configurations
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get("departmentId");
        const id = searchParams.get("id");

        if (id) {
            // Get specific department role
            const deptRole = await queryOne(
                `SELECT dr.*, d.name as department_name, rt.name as template_name
                 FROM department_roles dr
                 LEFT JOIN departments d ON dr.department_id = d.id
                 LEFT JOIN rubric_templates rt ON dr.default_template_id = rt.id
                 WHERE dr.id = $1
                   AND ${canonicalRoleScopeSql("dr")}`,
                [id]
            );
            return NextResponse.json({ data: deptRole });
        }

        if (departmentId) {
            // Get roles for specific department
            const deptRoles = await query(
                `SELECT dr.*, d.name as department_name, rt.name as template_name
                 FROM department_roles dr
                 LEFT JOIN departments d ON dr.department_id = d.id
                 LEFT JOIN rubric_templates rt ON dr.default_template_id = rt.id
                 WHERE dr.department_id = $1
                   AND ${canonicalRoleScopeSql("dr")}
                 ORDER BY dr.role`,
                [departmentId]
            );
            return NextResponse.json({ data: deptRoles });
        }

        // Get all department roles
        const allRoles = await query(
            `SELECT dr.*, d.name as department_name, rt.name as template_name
             FROM department_roles dr
             LEFT JOIN departments d ON dr.department_id = d.id
             LEFT JOIN rubric_templates rt ON dr.default_template_id = rt.id
             WHERE ${canonicalRoleScopeSql("dr")}
             ORDER BY dr.updated_at DESC`
        );
        return NextResponse.json({ data: allRoles });
    } catch (error) {
        console.error("Department roles error:", error);
        return NextResponse.json({ error: "Failed to fetch department roles" }, { status: 500 });
    }
}

// POST /api/admin/department-roles - Create department role configuration
export async function POST(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const { department_id, role, default_template_id, name } = body;

        if (!role) {
            return NextResponse.json({ error: "Role required" }, { status: 400 });
        }

        const finalDeptId = (department_id === "" || department_id === "none" || department_id == null)
            ? null
            : department_id;
        const normalizedRole = String(role).trim().toLowerCase();
        const normalizedName = typeof name === "string" && name.trim() ? name.trim() : null;
        if (!["admin", "director", "manager", "supervisor", "staff"].includes(normalizedRole)) {
            return NextResponse.json({ error: "Unsupported role" }, { status: 400 });
        }
        if (!isCanonicalRoleAssignment(normalizedRole, finalDeptId)) {
            return NextResponse.json(
                {
                    error: ["admin", "director"].includes(normalizedRole)
                        ? "Admin and director roles must be global."
                        : "Manager, supervisor, and staff roles require a department.",
                },
                { status: 400 },
            );
        }

        const newRole = await queryOne(
            `WITH inserted AS (
                INSERT INTO department_roles (department_id, role, default_template_id, name)
                VALUES ($1, $2, $3, $4)
                RETURNING *
             )
             SELECT i.*, d.name as department_name, rt.name as template_name
             FROM inserted i
             LEFT JOIN departments d ON i.department_id = d.id
             LEFT JOIN rubric_templates rt ON i.default_template_id = rt.id`,
            [finalDeptId, normalizedRole, default_template_id ?? null, normalizedName]
        );

        return NextResponse.json({ data: newRole }, { status: 201 });
    } catch (error) {
        console.error("Create department role error:", error);
        return NextResponse.json({ error: "Failed to create department role" }, { status: 500 });
    }
}

// PUT /api/admin/department-roles - Update department role configuration
export async function PUT(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const { id, default_template_id, name } = body;

        if (!id) {
            return NextResponse.json({ error: "Department role ID required" }, { status: 400 });
        }

        const normalizedName = typeof name === "string" ? (name.trim() || null) : undefined;
        const updated = await queryOne(
            `UPDATE department_roles 
             SET default_template_id = COALESCE($1, default_template_id), 
                 name = CASE WHEN $2::boolean THEN $3 ELSE name END,
                 updated_at = now()
             WHERE id = $4
             RETURNING *`,
            [default_template_id ?? null, name !== undefined, normalizedName ?? null, id]
        );

        if (!updated) {
            return NextResponse.json({ error: "Department role not found" }, { status: 404 });
        }

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update department role error:", error);
        return NextResponse.json({ error: "Failed to update department role" }, { status: 500 });
    }
}

// DELETE /api/admin/department-roles - Delete department role configuration
export async function DELETE(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Department role ID required" }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const roleResult = await client.query<{ role: string; departmentId: string | null }>(
                `SELECT role::text AS role, department_id::text AS "departmentId"
                   FROM department_roles
                  WHERE id = $1
                  FOR UPDATE`,
                [id],
            );
            const role = roleResult.rows[0];
            if (!role) {
                await client.query("ROLLBACK");
                return NextResponse.json({ error: "Department role not found" }, { status: 404 });
            }
            if (role.departmentId === null && ["admin", "director"].includes(role.role)) {
                await client.query("ROLLBACK");
                return NextResponse.json(
                    { error: "Global admin and director role definitions cannot be deleted." },
                    { status: 400 },
                );
            }

            const memberResult = await client.query<{ userId: string }>(
                `SELECT user_id::text AS "userId"
                   FROM department_role_memberships
                  WHERE department_role_id = $1`,
                [id],
            );
            const affectedUserIds = memberResult.rows.map((member) => member.userId);

            await client.query(`DELETE FROM department_roles WHERE id = $1`, [id]);
            await rebuildUserRoleProjection(client, affectedUserIds);
            await client.query("COMMIT");
            return NextResponse.json({ message: "Department role deleted" });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Delete department role error:", error);
        return NextResponse.json({ error: "Failed to delete department role" }, { status: 500 });
    }
}

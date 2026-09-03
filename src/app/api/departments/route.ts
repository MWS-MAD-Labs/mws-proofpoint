import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool, query, queryOne } from "@/lib/db";

// Helper to check if user is admin
function isAdmin(session: { user: { roles?: string[] } }) {
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    return roles.includes("admin");
}

// GET /api/departments - List all departments with hierarchy and role holders
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get departments with parent info and user count
        const departments = await query(
            `SELECT d.*, p.name as parent_name,
                    (SELECT COUNT(DISTINCT drm.user_id)
                       FROM department_role_memberships drm
                       JOIN department_roles dr ON dr.id = drm.department_role_id
                      WHERE dr.department_id = d.id) as user_count,
                    CASE 
                        WHEN d.parent_id IS NULL THEN 'root'
                        WHEN EXISTS (SELECT 1 FROM departments child WHERE child.parent_id = d.id) THEN 'department'
                        ELSE 'subdepartment'
                    END as hierarchy_level
             FROM departments d
             LEFT JOIN departments p ON d.parent_id = p.id
             ORDER BY d.name`
        );

        // Get explicit role holders for each department.
        const roleHolders = await query(
            `SELECT dr.department_id, u.id AS user_id, p.full_name, u.email, dr.role
             FROM department_role_memberships drm
             JOIN department_roles dr ON dr.id = drm.department_role_id
             JOIN users u ON u.id = drm.user_id AND u.status <> 'deleted'
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE dr.department_id IS NOT NULL
             ORDER BY dr.department_id, dr.role, p.full_name NULLS LAST, u.email`
        );

        // Build a map of department_id -> role holders
        const roleHolderMap: Record<string, Array<{ user_id: string; full_name: string; email: string; role: string }>> = {};
        for (const holder of roleHolders as any[]) {
            if (!roleHolderMap[holder.department_id]) {
                roleHolderMap[holder.department_id] = [];
            }
            roleHolderMap[holder.department_id].push({
                user_id: holder.user_id,
                full_name: holder.full_name,
                email: holder.email,
                role: holder.role
            });
        }

        // Attach role holders to departments
        const departmentsWithRoles = (departments as any[]).map(dept => ({
            ...dept,
            role_holders: roleHolderMap[dept.id] || []
        }));

        return NextResponse.json({ data: departmentsWithRoles });
    } catch (error) {
        console.error("Departments error:", error);
        return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
    }
}

// POST /api/departments - Create department (admin only)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isAdmin(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { name, parent_id } = body;

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const departmentResult = await client.query(
                `INSERT INTO departments (name, parent_id) VALUES ($1, $2) RETURNING *`,
                [name, parent_id ?? null]
            );
            const newDept = departmentResult.rows[0];

            await client.query(
                `INSERT INTO department_roles (department_id, role, name, created_at, updated_at)
                 VALUES ($1, 'manager', $2, NOW(), NOW()),
                        ($1, 'supervisor', $3, NOW(), NOW()),
                        ($1, 'staff', $4, NOW(), NOW())`,
                [newDept.id, `${name} manager`, `${name} supervisor`, `${name} staff`]
            );

            await client.query("COMMIT");
            return NextResponse.json({ data: newDept }, { status: 201 });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Create department error:", error);
        return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
    }
}

// PUT /api/departments - Update department (admin only)
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isAdmin(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, parent_id } = body;

        if (!id) {
            return NextResponse.json({ error: "Department ID required" }, { status: 400 });
        }

        // Prevent circular references
        if (parent_id === id) {
            return NextResponse.json({ error: "Cannot set department as its own parent" }, { status: 400 });
        }

        const updated = await queryOne(
            `UPDATE departments 
             SET name = COALESCE($1, name),
                 parent_id = $2,
                 updated_at = now()
             WHERE id = $3
             RETURNING *`,
            [name, parent_id ?? null, id]
        );

        if (!updated) {
            return NextResponse.json({ error: "Department not found" }, { status: 404 });
        }

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update department error:", error);
        return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
    }
}

// DELETE /api/departments - Delete department (admin only)
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isAdmin(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Department ID required" }, { status: 400 });
        }

        const assignedUsers = await query<{ fullName: string | null; email: string }>(
            `SELECT DISTINCT p.full_name AS "fullName", u.email
               FROM department_role_memberships drm
               JOIN department_roles dr ON dr.id = drm.department_role_id
               JOIN users u ON u.id = drm.user_id
               LEFT JOIN profiles p ON p.user_id = u.id
              WHERE dr.department_id = $1
              ORDER BY p.full_name NULLS LAST, u.email`,
            [id]
        );

        if (assignedUsers.length > 0) {
            const preview = assignedUsers
                .slice(0, 3)
                .map((user) => user.fullName || user.email)
                .join(", ");
            const remaining = assignedUsers.length - 3;
            return NextResponse.json({
                error: `Cannot delete department because ${assignedUsers.length} user(s) still have role assignments in it: ${preview}${remaining > 0 ? ` and ${remaining} more` : ""}. Remove those assignments from the Department page first.`
            }, { status: 400 });
        }

        const configurationCount = await queryOne<{ count: string }>(
            `SELECT (
                (SELECT COUNT(*)
                   FROM role_workflow_assignments rwa
                   JOIN department_roles dr ON dr.id = rwa.department_role_id
                  WHERE dr.department_id = $1) +
                (SELECT COUNT(*) FROM rubric_templates WHERE department_id = $1) +
                (SELECT COUNT(*) FROM strategic_plans WHERE department_id = $1) +
                (SELECT COUNT(*) FROM program_collaborators WHERE department_id = $1)
             )::text AS count`,
            [id]
        );

        if (configurationCount && parseInt(configurationCount.count) > 0) {
            return NextResponse.json({
                error: "Cannot delete department because workflows, rubrics, strategic plans, or program collaborations still reference it. Reassign that configuration first."
            }, { status: 400 });
        }

        // Check if department has child departments
        const childCount = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM departments WHERE parent_id = $1`,
            [id]
        );

        if (childCount && parseInt(childCount.count) > 0) {
            return NextResponse.json({
                error: "Cannot delete department with child departments. Delete children first."
            }, { status: 400 });
        }

        await query(`DELETE FROM departments WHERE id = $1`, [id]);
        return NextResponse.json({ message: "Department deleted" });
    } catch (error) {
        console.error("Delete department error:", error);
        const code = (error as { code?: string }).code;
        if (code === "23503") {
            return NextResponse.json({
                error: "Cannot delete department because other records still reference it. Reassign or remove its workflows, rubrics, plans, and related configuration first."
            }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to delete department" }, { status: 500 });
    }
}

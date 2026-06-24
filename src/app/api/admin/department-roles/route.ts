import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

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
                 WHERE dr.id = $1`,
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

        // department_id can be null for global roles
        const finalDeptId = (department_id === "" || department_id === "none") ? null : department_id;

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
            [finalDeptId, role, default_template_id ?? null, name ?? null]
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

        const updated = await queryOne(
            `UPDATE department_roles 
             SET default_template_id = COALESCE($1, default_template_id), 
                 name = COALESCE($2, name),
                 updated_at = now()
             WHERE id = $3
             RETURNING *`,
            [default_template_id ?? null, name ?? null, id]
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

        await query(`DELETE FROM department_roles WHERE id = $1`, [id]);
        return NextResponse.json({ message: "Department role deleted" });
    } catch (error) {
        console.error("Delete department role error:", error);
        return NextResponse.json({ error: "Failed to delete department role" }, { status: 500 });
    }
}

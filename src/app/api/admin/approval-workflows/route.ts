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

// GET /api/admin/approval-workflows - Get approval workflow steps
export async function GET(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { searchParams } = new URL(request.url);
        const departmentRoleId = searchParams.get("departmentRoleId");

        if (departmentRoleId) {
            // Get workflow for specific department role
            const workflows = await query(
                `SELECT aw.*, dr.role as target_role, d.name as department_name
                 FROM approval_workflows aw
                 JOIN department_roles dr ON aw.department_role_id = dr.id
                 JOIN departments d ON dr.department_id = d.id
                 WHERE aw.department_role_id = $1
                 ORDER BY aw.step_order`,
                [departmentRoleId]
            );
            return NextResponse.json({ data: workflows });
        }

        // Get all workflows grouped by department role
        const allWorkflows = await query(
            `SELECT aw.*, dr.role as target_role, d.name as department_name, dr.id as department_role_id
             FROM approval_workflows aw
             JOIN department_roles dr ON aw.department_role_id = dr.id
             JOIN departments d ON dr.department_id = d.id
             ORDER BY d.name, dr.role, aw.step_order`
        );
        return NextResponse.json({ data: allWorkflows });
    } catch (error) {
        console.error("Approval workflows error:", error);
        return NextResponse.json({ error: "Failed to fetch approval workflows" }, { status: 500 });
    }
}

// POST /api/admin/approval-workflows - Create approval workflow step
export async function POST(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const { department_role_id, step_order, approver_role, step_type } = body;

        if (!department_role_id || step_order === undefined || !approver_role || !step_type) {
            return NextResponse.json({
                error: "department_role_id, step_order, approver_role, and step_type required"
            }, { status: 400 });
        }

        const validStepTypes = ["review", "approval", "review_and_approval", "acknowledge", "admin_review"];
        if (!validStepTypes.includes(step_type)) {
            return NextResponse.json({
                error: `Invalid step_type. Must be one of: ${validStepTypes.join(", ")}`
            }, { status: 400 });
        }

        const newStep = await queryOne(
            `INSERT INTO approval_workflows (department_role_id, step_order, approver_role, step_type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [department_role_id, step_order, approver_role, step_type]
        );

        return NextResponse.json({ data: newStep }, { status: 201 });
    } catch (error) {
        console.error("Create approval workflow error:", error);
        return NextResponse.json({ error: "Failed to create approval workflow" }, { status: 500 });
    }
}

// PUT /api/admin/approval-workflows - Update approval workflow step
export async function PUT(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const { id, step_order, approver_role, step_type } = body;

        if (!id) {
            return NextResponse.json({ error: "Workflow step ID required" }, { status: 400 });
        }

        const setClauses: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (step_order !== undefined) {
            setClauses.push(`step_order = $${paramIndex++}`);
            params.push(step_order);
        }
        if (approver_role) {
            setClauses.push(`approver_role = $${paramIndex++}`);
            params.push(approver_role);
        }
        if (step_type) {
            setClauses.push(`step_type = $${paramIndex++}`);
            params.push(step_type);
        }

        if (setClauses.length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        params.push(id);
        const updated = await queryOne(
            `UPDATE approval_workflows SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        if (!updated) {
            return NextResponse.json({ error: "Workflow step not found" }, { status: 404 });
        }

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update approval workflow error:", error);
        return NextResponse.json({ error: "Failed to update approval workflow" }, { status: 500 });
    }
}

// DELETE /api/admin/approval-workflows - Delete approval workflow step
export async function DELETE(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const departmentRoleId = searchParams.get("departmentRoleId");

        if (departmentRoleId) {
            // Delete all workflow steps for a department role
            await query(`DELETE FROM approval_workflows WHERE department_role_id = $1`, [departmentRoleId]);
            return NextResponse.json({ message: "All workflow steps deleted" });
        }

        if (!id) {
            return NextResponse.json({ error: "Workflow step ID required" }, { status: 400 });
        }

        await query(`DELETE FROM approval_workflows WHERE id = $1`, [id]);
        return NextResponse.json({ message: "Workflow step deleted" });
    } catch (error) {
        console.error("Delete approval workflow error:", error);
        return NextResponse.json({ error: "Failed to delete approval workflow" }, { status: 500 });
    }
}

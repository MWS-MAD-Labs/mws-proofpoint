import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/workflows - Get approval workflow steps (public, for authenticated users)
// This is a read-only endpoint for fetching workflow configuration
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const departmentRoleId = searchParams.get("departmentRoleId");

        if (!departmentRoleId) {
            return NextResponse.json({ error: "departmentRoleId is required" }, { status: 400 });
        }

        // Get workflow for specific department role
        const workflows = await query(
            `SELECT aw.id, aw.department_role_id, aw.step_order, aw.approver_role, aw.step_type
             FROM approval_workflows aw
             WHERE aw.department_role_id = $1
             ORDER BY aw.step_order`,
            [departmentRoleId]
        );

        return NextResponse.json({ data: workflows });
    } catch (error) {
        console.error("Workflows error:", error);
        return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 });
    }
}

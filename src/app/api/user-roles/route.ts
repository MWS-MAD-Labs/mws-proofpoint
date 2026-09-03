import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { canonicalRoleScopeSql } from "@/lib/organization-access";

// GET /api/user-roles - Get roles for a user
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId") ?? session.user.id;

        const roles = await query(
            `SELECT DISTINCT dr.role
               FROM department_role_memberships drm
               JOIN department_roles dr ON dr.id = drm.department_role_id
              WHERE drm.user_id = $1
                AND ${canonicalRoleScopeSql("dr")}
              ORDER BY dr.role`,
            [userId]
        );

        return NextResponse.json({ data: roles });
    } catch (error) {
        console.error("User roles error:", error);
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }
}

// Roles are assigned only through department role memberships.
export async function POST() {
    return NextResponse.json(
        { error: "Manage roles from Administration → Departments." },
        { status: 409 },
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: "Manage roles from Administration → Departments." },
        { status: 409 },
    );
}

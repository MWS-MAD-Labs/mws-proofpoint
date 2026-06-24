import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

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
            `SELECT role FROM user_roles WHERE user_id = $1`,
            [userId]
        );

        return NextResponse.json({ data: roles });
    } catch (error) {
        console.error("User roles error:", error);
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }
}

// POST /api/user-roles - Assign role to user (admin only)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin
        const roles = (session.user as { roles?: string[] }).roles ?? [];
        if (!roles.includes("admin")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { user_id, role } = body;

        // Check if role already exists
        const existing = await query(
            `SELECT id FROM user_roles WHERE user_id = $1 AND role = $2`,
            [user_id, role]
        );

        if ((existing as unknown[]).length > 0) {
            return NextResponse.json({ error: "Role already assigned" }, { status: 409 });
        }

        await query(
            `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
            [user_id, role]
        );

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Assign role error:", error);
        return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
    }
}

// DELETE /api/user-roles - Remove role from user (admin only)
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin
        const roles = (session.user as { roles?: string[] }).roles ?? [];
        if (!roles.includes("admin")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const role = searchParams.get("role");

        if (!userId || !role) {
            return NextResponse.json({ error: "userId and role required" }, { status: 400 });
        }

        await query(
            `DELETE FROM user_roles WHERE user_id = $1 AND role = $2`,
            [userId, role]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Remove role error:", error);
        return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// GET /api/profiles - List all profiles (admin) or get current user profile
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (userId) {
            // Get specific user profile
            const profile = await queryOne(
                `SELECT p.*, d.name as department_name
         FROM profiles p
         LEFT JOIN departments d ON p.department_id = d.id
         WHERE p.user_id = $1`,
                [userId]
            );
            return NextResponse.json({ data: profile });
        }

        // Get all profiles (for admin/manager views)
        const profiles = await query(
            `SELECT p.*, d.name as department_name
       FROM profiles p
       LEFT JOIN departments d ON p.department_id = d.id
       ORDER BY p.full_name`
        );

        return NextResponse.json({ data: profiles });
    } catch (error) {
        console.error("Profiles error:", error);
        return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }
}

// PUT /api/profiles - Update current user's profile
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { full_name, department_id, avatar_url } = body;

        const updated = await queryOne(
            `UPDATE profiles 
       SET full_name = COALESCE($1, full_name),
           department_id = COALESCE($2, department_id),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = now()
       WHERE user_id = $4
       RETURNING *`,
            [full_name, department_id, avatar_url, session.user.id]
        );

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update profile error:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}

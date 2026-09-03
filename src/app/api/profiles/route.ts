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
                `SELECT p.*,
                        CASE WHEN COUNT(DISTINCT dr.department_id) FILTER (WHERE dr.department_id IS NOT NULL) = 1
                          THEN MIN(dr.department_id::text) FILTER (WHERE dr.department_id IS NOT NULL)
                          ELSE NULL
                        END AS department_id,
                        CASE WHEN COUNT(DISTINCT dr.department_id) FILTER (WHERE dr.department_id IS NOT NULL) = 1
                          THEN MIN(d.name) FILTER (WHERE dr.department_id IS NOT NULL)
                          ELSE NULL
                        END AS department_name,
                        COALESCE(
                          JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('id', dr.department_id, 'name', d.name))
                            FILTER (WHERE dr.department_id IS NOT NULL),
                          '[]'::jsonb
                        ) AS departments,
                        COALESCE(
                          ARRAY_AGG(DISTINCT dr.role::text) FILTER (WHERE dr.role IS NOT NULL),
                          ARRAY[]::text[]
                        ) AS roles
                   FROM profiles p
                   LEFT JOIN department_role_memberships drm ON drm.user_id = p.user_id
                   LEFT JOIN department_roles dr ON dr.id = drm.department_role_id
                   LEFT JOIN departments d ON d.id = dr.department_id
                  WHERE p.user_id = $1
                  GROUP BY p.id`,
                [userId]
            );
            return NextResponse.json({ data: profile });
        }

        // Get all profiles (for admin/manager views)
        const profiles = await query(
            `SELECT p.*,
                    COALESCE(
                      JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('id', dr.department_id, 'name', d.name))
                        FILTER (WHERE dr.department_id IS NOT NULL),
                      '[]'::jsonb
                    ) AS departments,
                    COALESCE(
                      ARRAY_AGG(DISTINCT dr.role::text) FILTER (WHERE dr.role IS NOT NULL),
                      ARRAY[]::text[]
                    ) AS roles
               FROM profiles p
               LEFT JOIN department_role_memberships drm ON drm.user_id = p.user_id
               LEFT JOIN department_roles dr ON dr.id = drm.department_role_id
               LEFT JOIN departments d ON d.id = dr.department_id
              GROUP BY p.id
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
        const { full_name, avatar_url } = body;

        const updated = await queryOne(
            `UPDATE profiles
       SET full_name = COALESCE($1, full_name),
           avatar_url = COALESCE($2, avatar_url),
           updated_at = now()
       WHERE user_id = $3
       RETURNING *`,
            [full_name, avatar_url, session.user.id]
        );

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update profile error:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}

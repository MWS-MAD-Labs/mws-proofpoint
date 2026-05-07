
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { triggerNotification } from "@/lib/notifications";

// GET /api/admin/assessments - List all assessments for admin review
export async function GET(request: Request) {
    try {
        const session = await auth();
        // Check for admin role
        const roles = (session?.user as any)?.roles || [];
        if (!roles.includes("admin")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        let sql = `
            SELECT a.*, 
                   sp.full_name as staff_name,
                   sp.niy as staff_niy,
                   d.name as staff_department,
                   mp.full_name as manager_name,
                   dp.full_name as director_name
            FROM assessments a
            LEFT JOIN profiles sp ON a.staff_id = sp.user_id
            LEFT JOIN departments d ON sp.department_id = d.id
            LEFT JOIN profiles mp ON a.manager_id = mp.user_id
            LEFT JOIN profiles dp ON a.director_id = dp.user_id
            WHERE 1=1
        `;

        const params: any[] = [];

        // If status filter is provided, use it. Otherwise default to "director_approved" (pending admin review)
        if (status) {
            sql += ` AND a.status = $1`;
            params.push(status);
        } else {
            // Default: show everything that is at least approved, so admin can review history too
            // But meant 'pending' usually. Let's just return all non-draft for now?
            // Or specific statuses.
            // Let's return everything for the list, frontend can filter.
        }

        sql += ` ORDER BY a.created_at DESC`;

        const assessments = await query(sql, params);
        return NextResponse.json({ data: assessments });
    } catch (error) {
        console.error("Admin assessments error:", error);
        return NextResponse.json({ error: "Failed to fetch assessments" }, { status: 500 });
    }
}

// PUT /api/admin/assessments - Update status (Release)
export async function PUT(request: Request) {
    try {
        const session = await auth();
        const roles = (session?.user as any)?.roles || [];
        if (!roles.includes("admin")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, action } = body;

        if (!id || !action) {
            return NextResponse.json({ error: "ID and action required" }, { status: 400 });
        }

        if (action === 'release') {
            const updated = await queryOne(
                `UPDATE assessments
                 SET status = 'admin_reviewed',
                     updated_at = now()
                 WHERE id = $1
                 RETURNING *`,
                [id]
            );

            // Trigger notification to staff member
            if (updated) {
                triggerNotification({
                    assessmentId: id,
                    type: "admin_released",
                }).catch((error) => {
                    console.error("[API] Admin release notification failed:", error);
                });
            }

            return NextResponse.json({ data: updated });
        }

        if (action === 'release_all') {
            // Release all assessments with 'director_approved' status
            const updated = await query(
                `UPDATE assessments
                 SET status = 'admin_reviewed',
                     updated_at = now()
                 WHERE status = 'director_approved'
                 RETURNING id`
            );

            // Trigger notifications for all released assessments
            if (updated && updated.length > 0) {
                for (const assessment of updated) {
                    triggerNotification({
                        assessmentId: assessment.id,
                        type: "admin_released",
                    }).catch((error) => {
                        console.error(`[API] Failed to trigger notification for assessment ${assessment.id}:`, error);
                    });
                }
            }

            return NextResponse.json({ data: updated, count: updated?.length || 0 });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("Admin update error:", error);
        return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 });
    }
}

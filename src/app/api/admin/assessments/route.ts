import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { triggerNotification } from "@/lib/notifications";
import { calculateStoredAssessmentFinalResult } from "@/features/assessments/server/final-score";

interface SessionUserWithRoles {
  roles?: string[];
}

interface AssessmentActionBody {
  id?: string;
  action?: string;
}

// GET /api/admin/assessments - List all assessments for admin review
export async function GET(request: Request) {
  try {
    const session = await auth();
    // Check for admin role
    const roles = (session?.user as SessionUserWithRoles | undefined)?.roles ?? [];
    if (!roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let sql = `
            SELECT a.*,
                   sp.full_name as staff_name,
                   sp.niy as staff_niy,
                   staff_department.department_name as staff_department,
                   mp.full_name as manager_name,
                   dp.full_name as director_name
            FROM assessments a
            LEFT JOIN profiles sp ON a.staff_id = sp.user_id
            LEFT JOIN LATERAL (
              SELECT d.name AS department_name
                FROM department_role_memberships drm
                JOIN department_roles dr ON dr.id = drm.department_role_id
                JOIN departments d ON d.id = dr.department_id
               WHERE drm.user_id = a.staff_id AND dr.role::text = 'staff'
               ORDER BY d.name, dr.department_id
               LIMIT 1
            ) staff_department ON true
            LEFT JOIN profiles mp ON a.manager_id = mp.user_id
            LEFT JOIN profiles dp ON a.director_id = dp.user_id
            WHERE 1=1
        `;

    const params: unknown[] = [];

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
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/assessments - Update status (Release)
export async function PUT(request: Request) {
  try {
    const session = await auth();
    const roles = (session?.user as SessionUserWithRoles | undefined)?.roles ?? [];
    if (!roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AssessmentActionBody;
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "ID and action required" },
        { status: 400 },
      );
    }

    if (action === "release") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(
          "SELECT id FROM assessments WHERE id = $1 FOR UPDATE",
          [id],
        );
        if (existing.rowCount === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
        }

        const finalResult = await calculateStoredAssessmentFinalResult(client, id);
        if (!finalResult) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Unable to calculate the final score from stored ratings" },
            { status: 400 },
          );
        }

        const updatedResult = await client.query(
          `UPDATE assessments
           SET status = 'admin_reviewed',
               final_score = $2,
               final_grade = $3,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [id, finalResult.score, finalResult.grade],
        );
        await client.query("COMMIT");
        const updated = updatedResult.rows[0];

        triggerNotification({
          assessmentId: id,
          type: "admin_released",
        }).catch((error) => {
          console.error("[API] Admin release notification failed:", error);
        });

        return NextResponse.json({ data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === "release_all") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const pending = await client.query<{ id: string }>(
          "SELECT id FROM assessments WHERE status = 'director_approved' ORDER BY created_at FOR UPDATE",
        );
        const updated: Array<{ id: string }> = [];

        for (const assessment of pending.rows) {
          const finalResult = await calculateStoredAssessmentFinalResult(client, assessment.id);
          if (!finalResult) {
            throw new Error(`Unable to calculate final score for assessment ${assessment.id}`);
          }
          await client.query(
            `UPDATE assessments
             SET status = 'admin_reviewed',
                 final_score = $2,
                 final_grade = $3,
                 updated_at = now()
             WHERE id = $1`,
            [assessment.id, finalResult.score, finalResult.grade],
          );
          updated.push({ id: assessment.id });
        }
        await client.query("COMMIT");

        for (const assessment of updated) {
          triggerNotification({
            assessmentId: assessment.id,
            type: "admin_released",
          }).catch((error) => {
            console.error(
              `[API] Failed to trigger notification for assessment ${assessment.id}:`,
              error,
            );
          });
        }

        return NextResponse.json({ data: updated, count: updated.length });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Admin update error:", error);
    return NextResponse.json(
      { error: "Failed to update assessment" },
      { status: 500 },
    );
  }
}

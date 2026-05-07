import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { triggerNotification } from "@/lib/notifications";
import type { NotificationType } from "@/lib/notifications/types";

// GET /api/assessments - List assessments based on user role
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("id");
    const staffId = searchParams.get("staffId");
    const status = searchParams.get("status");
    const limitParam = searchParams.get("limit");

    // Get single assessment
    if (assessmentId) {
      const assessment = await queryOne(
        `SELECT a.*,
                rt.name as template_name,
                sp.full_name as staff_name,
                sp.job_title as staff_job_title,
                sp.department_id as staff_department_id,
                d.name as staff_department,
                mp.full_name as manager_name,
                mp.job_title as manager_job_title,
                dp.full_name as director_name,
                dp.job_title as director_job_title
         FROM assessments a
         LEFT JOIN rubric_templates rt ON a.template_id = rt.id
         LEFT JOIN profiles sp ON a.staff_id = sp.user_id
         LEFT JOIN departments d ON sp.department_id = d.id
         LEFT JOIN profiles mp ON a.manager_id = mp.user_id
         LEFT JOIN profiles dp ON a.director_id = dp.user_id
         WHERE a.id = $1`,
        [assessmentId],
      );
      return NextResponse.json({ data: assessment });
    }

    // Build query based on filters
    let sql = `
      SELECT a.*,
             rt.name as template_name,
             sp.full_name as staff_name,
             sp.job_title as staff_job_title,
             d.name as staff_department,
             mp.full_name as manager_name,
             mp.job_title as manager_job_title,
             (
                SELECT array_agg(role)
                FROM user_roles
                WHERE user_id = a.staff_id
             ) as staff_roles
      FROM assessments a
      LEFT JOIN rubric_templates rt ON a.template_id = rt.id
      LEFT JOIN profiles sp ON a.staff_id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN profiles mp ON a.manager_id = mp.user_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply Role-Based Filtering
    const roles = (session.user as { roles?: string[] }).roles || [];
    const departmentId = (session.user as { departmentId?: string })
      .departmentId;
    const userId = session.user.id;

    const isAdmin = roles.includes("admin");
    const isDirector = roles.includes("director");
    const isManager = roles.includes("manager");

    if (isAdmin || isDirector) {
      // Admins and Directors see all assessments
    } else if (isManager) {
      // Manager sees:
      // 1. Staff in their department
      // 2. Assessments they explicitly manage
      // 3. Their own assessments
      sql += ` AND (sp.department_id = $${paramIndex++} OR a.manager_id = $${paramIndex++} OR a.staff_id = $${paramIndex++})`;
      params.push(departmentId ?? null, userId, userId);
    } else {
      // Staff see only their own assessments
      sql += ` AND a.staff_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (staffId) {
      sql += ` AND a.staff_id = $${paramIndex++}`;
      params.push(staffId);
    }

    if (status) {
      sql += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY a.created_at DESC`;

    if (limitParam) {
      const parsedLimit = Number.parseInt(limitParam, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
        const safeLimit = Math.min(parsedLimit, 100);
        sql += ` LIMIT $${paramIndex++}`;
        params.push(safeLimit);
      }
    }

    const assessments = await query(sql, params);
    return NextResponse.json({ data: assessments });
  } catch (error) {
    console.error("Assessments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 },
    );
  }
}

// POST /api/assessments - Create new assessment
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, period, manager_id, director_id } = body;

    // Check for existing non-finalized assessment for this period/template
    const existing = await queryOne(
      `SELECT id FROM assessments
             WHERE staff_id = $1 AND template_id = $2 AND period = $3
             AND status != 'acknowledged'`,
      [session.user.id, template_id, period],
    );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "An active assessment already exists for this period and framework.",
        },
        { status: 400 },
      );
    }

    // Auto-assign director if not provided
    let finalDirectorId = director_id;
    if (!finalDirectorId) {
      const director = await queryOne(
        `SELECT ur.user_id FROM user_roles ur
         JOIN profiles p ON ur.user_id = p.user_id
         WHERE ur.role = 'director'
         LIMIT 1`
      );
      finalDirectorId = director?.user_id || null;
    }

    const newAssessment = await queryOne(
      `INSERT INTO assessments (staff_id, template_id, period, manager_id, director_id, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING *`,
      [
        session.user.id,
        template_id,
        period,
        manager_id ?? null,
        finalDirectorId,
      ],
    );

    return NextResponse.json({ data: newAssessment }, { status: 201 });
  } catch (error) {
    console.error("Create assessment error:", error);
    return NextResponse.json(
      { error: "Failed to create assessment" },
      { status: 500 },
    );
  }
}

// PUT /api/assessments - Update assessment
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Assessment ID required" },
        { status: 400 },
      );
    }

    const existingAssessment = await queryOne<{
      id: string;
      staff_id: string;
      status: string;
    }>("SELECT id, staff_id, status FROM assessments WHERE id = $1", [id]);

    if (!existingAssessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 },
      );
    }

    // Prevent invalid completed state: only the owner can acknowledge, and feedback is mandatory.
    if (updates.status === "acknowledged") {
      if (existingAssessment.staff_id !== session.user.id) {
        return NextResponse.json(
          { error: "Only the assessment owner can acknowledge this review" },
          { status: 403 },
        );
      }

      const acknowledgementText =
        typeof updates.staff_notes === "string"
          ? updates.staff_notes.trim()
          : "";

      if (!acknowledgementText) {
        return NextResponse.json(
          { error: "Staff acknowledgement feedback is required" },
          { status: 400 },
        );
      }

      if (
        !["admin_reviewed", "acknowledged"].includes(existingAssessment.status)
      ) {
        return NextResponse.json(
          {
            error: "Assessment can only be acknowledged after admin release",
          },
          { status: 400 },
        );
      }

      updates.staff_notes = acknowledgementText;
    }

    // Build dynamic update query
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = [
      "staff_scores",
      "manager_scores",
      "staff_evidence",
      "manager_evidence",
      "manager_notes",
      "director_comments",
      "staff_notes",
      "final_score",
      "final_grade",
      "status",
      "staff_submitted_at",
      "manager_reviewed_at",
      "director_approved_at",
      "return_feedback",
      "returned_at",
      "returned_by",
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex++}`);
        params.push(
          key.includes("scores") || key.includes("evidence")
            ? JSON.stringify(value)
            : value,
        );
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    setClauses.push("updated_at = now()");
    params.push(id);

    const updated = await queryOne(
      `UPDATE assessments SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (updates.status && updated) {
      const newStatus = updates.status;
      const notificationType = getNotificationTypeForStatus(newStatus);

      if (notificationType) {
        triggerNotification({
          assessmentId: id,
          type: notificationType,
        }).catch((error) => {
          const errorMsg =
            error instanceof Error
              ? error.message
              : "Unknown notification error";
          console.error("[API] Notification trigger failed:", errorMsg);
        });
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update assessment error:", error);
    return NextResponse.json(
      { error: "Failed to update assessment" },
      { status: 500 },
    );
  }
}

function getNotificationTypeForStatus(status: string): NotificationType | null {
  switch (status) {
    case "self_submitted":
      return "assessment_submitted";
    case "manager_reviewed":
      return "manager_review_completed";
    case "director_approved":
      return "director_approved";
    case "admin_reviewed":
      return "admin_released";
    case "acknowledged":
      return "assessment_acknowledged";
    case "rejected":
    case "returned":
      return "assessment_returned";
    default:
      return null;
  }
}

// DELETE /api/assessments - Delete assessment
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assessment ID required" },
        { status: 400 },
      );
    }

    // Fetch assessment to check ownership and status
    const assessment = await queryOne<{ staff_id: string; status: string }>(
      "SELECT staff_id, status FROM assessments WHERE id = $1",
      [id],
    );

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 },
      );
    }

    const isAdmin = (
      (session.user as { roles?: string[] }).roles ?? []
    ).includes("admin");
    const isOwner = assessment.staff_id === session.user.id;
    const isDraft =
      assessment.status === "draft" ||
      assessment.status === "rejected" ||
      assessment.status === "returned";

    // Permissions:
    // 1. Admin can delete anything
    // 2. Owner can delete if it's still a draft/rejected
    if (!isAdmin && !(isOwner && isDraft)) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to delete this assessment. Only drafts can be deleted by staff.",
        },
        { status: 403 },
      );
    }

    await query("DELETE FROM assessments WHERE id = $1", [id]);

    return NextResponse.json({ message: "Assessment deleted successfully" });
  } catch (error) {
    console.error("Delete assessment error:", error);
    return NextResponse.json(
      { error: "Failed to delete assessment" },
      { status: 500 },
    );
  }
}

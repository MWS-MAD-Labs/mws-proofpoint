// src/app/api/admin/role-workflow-assignments/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const departmentRoleId = searchParams.get("departmentRoleId");

  try {
    const whereClause = departmentRoleId
      ? `WHERE rwa.department_role_id = $1`
      : "";
    const params = departmentRoleId ? [departmentRoleId] : [];

    const rows = (await query(
      `SELECT
         rwa.id,
         rwa.department_role_id  AS "departmentRoleId",
         rwa.workflow_id         AS "workflowId",
         rwa.rubric_id           AS "rubricId",
         rwa.is_active           AS "isActive",
         rwa.created_at          AS "createdAt",
         wd.id   AS wf_id,   wd.name AS wf_name, wd.type AS wf_type, wd.description AS wf_description,
         rt.id   AS r_id,    rt.name AS r_name,   rt.template_type AS r_type,
         dr.id   AS dr_id,   dr.role AS dr_role,  dr.department_id AS dr_dept_id,
         d.name  AS dept_name
       FROM role_workflow_assignments rwa
       LEFT JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       LEFT JOIN rubric_templates     rt ON rt.id = rwa.rubric_id
       LEFT JOIN department_roles     dr ON dr.id = rwa.department_role_id
       LEFT JOIN departments           d ON  d.id = dr.department_id
       ${whereClause}
       ORDER BY rwa.created_at ASC`,
      params,
    )) as any[];

    const workflowIds = [
      ...new Set(rows.map((r: any) => r.wf_id).filter(Boolean)),
    ];
    const stepsMap: Record<string, any[]> = {};
    if (workflowIds.length > 0) {
      const steps = (await query(
        `SELECT * FROM workflow_steps WHERE workflow_id = ANY($1) ORDER BY step_order ASC`,
        [workflowIds],
      )) as any[];
      for (const s of steps) {
        if (!stepsMap[s.workflow_id]) stepsMap[s.workflow_id] = [];
        stepsMap[s.workflow_id].push({
          id: s.id,
          stepOrder: s.step_order,
          actorRole: s.actor_role,
          actionType: s.action_type,
          description: s.description,
        });
      }
    }

    const assignments = rows.map((r: any) => ({
      id: r.id,
      departmentRoleId: r.departmentRoleId,
      workflowId: r.workflowId,
      rubricId: r.rubricId,
      isActive: r.isActive,
      createdAt: r.createdAt,
      workflow: r.wf_id
        ? {
            id: r.wf_id,
            name: r.wf_name,
            type: r.wf_type,
            description: r.wf_description,
            steps: stepsMap[r.wf_id] ?? [],
          }
        : null,
      rubric: r.r_id
        ? { id: r.r_id, name: r.r_name, templateType: r.r_type }
        : null,
      departmentRole: r.dr_id
        ? {
            id: r.dr_id,
            role: r.dr_role,
            department: r.dept_name
              ? { id: r.dr_dept_id, name: r.dept_name }
              : null,
          }
        : null,
    }));

    return NextResponse.json(assignments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const body = await req.json();
    const { departmentRoleId, workflowId, rubricId } = body;

    if (!departmentRoleId || !workflowId) {
      return NextResponse.json(
        { error: "departmentRoleId and workflowId are required." },
        { status: 400 },
      );
    }

    // Verify dept role exists
    const deptRole = (await queryOne(
      `SELECT id FROM department_roles WHERE id = $1`,
      [departmentRoleId],
    )) as any;
    if (!deptRole)
      return NextResponse.json(
        { error: "Department role not found." },
        { status: 404 },
      );

    // Verify workflow exists
    const workflow = (await queryOne(
      `SELECT id, type FROM workflow_definitions WHERE id = $1`,
      [workflowId],
    )) as any;
    if (!workflow)
      return NextResponse.json(
        { error: "Workflow definition not found." },
        { status: 404 },
      );

    // Verify rubric and validate type match
    if (rubricId) {
      const rubric = (await queryOne(
        `SELECT id, template_type FROM rubric_templates WHERE id = $1`,
        [rubricId],
      )) as any;
      if (!rubric)
        return NextResponse.json(
          { error: "Rubric template not found." },
          { status: 404 },
        );

      if (
        workflow.type === "CLASSROOM_OBSERVATION" &&
        rubric.template_type !== "CLASSROOM_OBSERVATION" &&
        rubric.template_type !== "GENERIC"
      ) {
        return NextResponse.json(
          {
            error:
              "Observation workflow only allows CLASSROOM_OBSERVATION or GENERIC rubric templates.",
          },
          { status: 400 },
        );
      }
      if (
        workflow.type === "KPI_APPRAISAL" &&
        rubric.template_type !== "KPI_APPRAISAL" &&
        rubric.template_type !== "GENERIC"
      ) {
        return NextResponse.json(
          {
            error:
              "KPI Appraisal workflow only allows KPI_APPRAISAL or GENERIC rubric templates.",
          },
          { status: 400 },
        );
      }
    }

    const id = randomUUID();
    await queryOne(
      `INSERT INTO role_workflow_assignments
         (id, department_role_id, workflow_id, rubric_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [id, departmentRoleId, workflowId, rubricId ?? null],
    );

    // Return full assignment
    const assignment = (await queryOne(
      `SELECT rwa.id, rwa.department_role_id AS "departmentRoleId",
              rwa.workflow_id AS "workflowId", rwa.rubric_id AS "rubricId",
              rwa.is_active AS "isActive",
              wd.name AS wf_name, wd.type AS wf_type,
              rt.name AS r_name, rt.template_type AS r_type
       FROM role_workflow_assignments rwa
       LEFT JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       LEFT JOIN rubric_templates rt ON rt.id = rwa.rubric_id
       WHERE rwa.id = $1`,
      [id],
    )) as any;

    return NextResponse.json(
      {
        ...assignment,
        workflow: assignment.wf_name
          ? {
              id: workflowId,
              name: assignment.wf_name,
              type: assignment.wf_type,
              steps: [],
            }
          : null,
        rubric: assignment.r_name
          ? {
              id: rubricId,
              name: assignment.r_name,
              templateType: assignment.r_type,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const body = await req.json();
    const { id, rubricId, isActive } = body;

    if (!id)
      return NextResponse.json(
        { error: "Assignment ID is required." },
        { status: 400 },
      );

    const existing = (await queryOne(
      `SELECT rwa.id, rwa.rubric_id, rwa.is_active, wd.type AS wf_type
       FROM role_workflow_assignments rwa
       LEFT JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       WHERE rwa.id = $1`,
      [id],
    )) as any;

    if (!existing)
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 },
      );

    // Validate rubric type if updating rubric
    if (rubricId) {
      const rubric = (await queryOne(
        `SELECT template_type FROM rubric_templates WHERE id = $1`,
        [rubricId],
      )) as any;
      if (!rubric)
        return NextResponse.json(
          { error: "Rubric template not found." },
          { status: 404 },
        );

      if (
        existing.wf_type === "CLASSROOM_OBSERVATION" &&
        rubric.template_type !== "CLASSROOM_OBSERVATION" &&
        rubric.template_type !== "GENERIC"
      ) {
        return NextResponse.json(
          {
            error:
              "Observation workflow only allows CLASSROOM_OBSERVATION or GENERIC rubric templates.",
          },
          { status: 400 },
        );
      }
      if (
        existing.wf_type === "KPI_APPRAISAL" &&
        rubric.template_type !== "KPI_APPRAISAL" &&
        rubric.template_type !== "GENERIC"
      ) {
        return NextResponse.json(
          {
            error:
              "KPI Appraisal workflow only allows KPI_APPRAISAL or GENERIC rubric templates.",
          },
          { status: 400 },
        );
      }
    }

    const nextRubricId =
      rubricId !== undefined ? (rubricId ?? null) : existing.rubric_id;
    const nextIsActive = isActive !== undefined ? isActive : existing.is_active;

    await queryOne(
      `UPDATE role_workflow_assignments
       SET rubric_id = $1,
           is_active = $2
       WHERE id = $3`,
      [nextRubricId, nextIsActive, id],
    );

    const updated = (await queryOne(
      `SELECT rwa.id, rwa.department_role_id AS "departmentRoleId",
              rwa.workflow_id AS "workflowId", rwa.rubric_id AS "rubricId",
              rwa.is_active AS "isActive",
              wd.id AS wf_id, wd.name AS wf_name, wd.type AS wf_type,
              rt.id AS r_id, rt.name AS r_name, rt.template_type AS r_type
       FROM role_workflow_assignments rwa
       LEFT JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       LEFT JOIN rubric_templates rt ON rt.id = rwa.rubric_id
       WHERE rwa.id = $1`,
      [id],
    )) as any;

    return NextResponse.json({
      ...updated,
      workflow: updated.wf_id
        ? {
            id: updated.wf_id,
            name: updated.wf_name,
            type: updated.wf_type,
            steps: [],
          }
        : null,
      rubric: updated.r_id
        ? {
            id: updated.r_id,
            name: updated.r_name,
            templateType: updated.r_type,
          }
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PUT /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json(
        { error: "Query parameter 'id' is required." },
        { status: 400 },
      );

    const existing = (await queryOne(
      `SELECT id FROM role_workflow_assignments WHERE id = $1`,
      [id],
    )) as any;
    if (!existing)
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 },
      );

    await queryOne(`DELETE FROM role_workflow_assignments WHERE id = $1`, [id]);

    return NextResponse.json({ message: "Assignment deleted successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

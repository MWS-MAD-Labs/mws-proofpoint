// src/app/api/admin/workflow-definitions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

const VALID_WORKFLOW_TYPES = ["KPI_APPRAISAL", "CLASSROOM_OBSERVATION", "GENERIC"];
const VALID_ACTION_TYPES   = ["FILL_FORM", "ACKNOWLEDGE", "REVIEW", "APPROVE"];
const VALID_ACTOR_ROLES    = ["admin", "staff", "manager", "director", "supervisor"];

interface StepInput {
  actorRole?: string;
  actionType?: string;
  description?: string | null;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const roles = (session.user as any).roles ?? [];
  if (!roles.includes("admin")) return { error: "Forbidden", status: 403 };
  return { session };
}

function validateSteps(steps: any): StepInput[] | { error: string } {
  if (!Array.isArray(steps)) return [];
  for (const s of steps) {
    if (s.actorRole && !VALID_ACTOR_ROLES.includes(s.actorRole))
      return { error: `Invalid actor role: ${s.actorRole}` };
    if (s.actionType && !VALID_ACTION_TYPES.includes(s.actionType))
      return { error: `Invalid action type: ${s.actionType}` };
  }
  return steps;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const workflows = await query(
      `SELECT id, name, type, description, created_at AS "createdAt"
       FROM workflow_definitions
       ORDER BY created_at DESC`
    ) as any[];

    // Fetch steps for all workflows
    const wfIds = workflows.map((w: any) => w.id);
    let stepsMap: Record<string, any[]> = {};
    if (wfIds.length > 0) {
      const steps = await query(
        `SELECT * FROM workflow_steps WHERE workflow_id = ANY($1) ORDER BY step_order ASC`,
        [wfIds]
      ) as any[];
      for (const s of steps) {
        if (!stepsMap[s.workflow_id]) stepsMap[s.workflow_id] = [];
        stepsMap[s.workflow_id].push({
          id: s.id, stepOrder: s.step_order, actorRole: s.actor_role,
          actionType: s.action_type, description: s.description,
        });
      }
    }

    // Fetch assignments for all workflows
    let assignmentsMap: Record<string, any[]> = {};
    if (wfIds.length > 0) {
      const assignments = await query(
        `SELECT rwa.id, rwa.workflow_id, rwa.department_role_id AS "departmentRoleId",
                rwa.rubric_id AS "rubricId", rwa.is_active AS "isActive",
                dr.role AS dr_role, d.id AS dept_id, d.name AS dept_name,
                rt.id AS r_id, rt.name AS r_name, rt.template_type AS r_type
         FROM role_workflow_assignments rwa
         LEFT JOIN department_roles dr ON dr.id = rwa.department_role_id
         LEFT JOIN departments d ON d.id = dr.department_id
         LEFT JOIN rubric_templates rt ON rt.id = rwa.rubric_id
         WHERE rwa.workflow_id = ANY($1)`,
        [wfIds]
      ) as any[];
      for (const a of assignments) {
        if (!assignmentsMap[a.workflow_id]) assignmentsMap[a.workflow_id] = [];
        assignmentsMap[a.workflow_id].push({
          id: a.id, departmentRoleId: a.departmentRoleId,
          rubricId: a.rubricId, isActive: a.isActive,
          departmentRole: a.dr_role ? {
            id: a.departmentRoleId, role: a.dr_role,
            department: a.dept_id ? { id: a.dept_id, name: a.dept_name } : null,
          } : null,
          rubric: a.r_id ? { id: a.r_id, name: a.r_name, templateType: a.r_type } : null,
        });
      }
    }

    const result = workflows.map((w: any) => ({
      ...w,
      steps:       stepsMap[w.id]       ?? [],
      assignments: assignmentsMap[w.id] ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Workflow definitions GET error:", error);
    return NextResponse.json({ error: "Failed to fetch workflow definitions" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const body = await request.json();
    const { name, type, description, steps } = body;

    if (!name?.trim())
      return NextResponse.json({ error: "Workflow name is required" }, { status: 400 });
    if (!type || !VALID_WORKFLOW_TYPES.includes(type))
      return NextResponse.json({ error: "Invalid workflow type" }, { status: 400 });

    const validatedSteps = validateSteps(steps);
    if (!Array.isArray(validatedSteps))
      return NextResponse.json({ error: (validatedSteps as any).error }, { status: 400 });

    const wfId = randomUUID();
    await queryOne(
      `INSERT INTO workflow_definitions (id, name, type, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [wfId, name.trim(), type, description?.trim() || null]
    );

    // Insert steps
    const createdSteps: any[] = [];
    for (let i = 0; i < validatedSteps.length; i++) {
      const s = validatedSteps[i];
      const stepId = randomUUID();
      await queryOne(
        `INSERT INTO workflow_steps (id, workflow_id, step_order, actor_role, action_type, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [stepId, wfId, i + 1, s.actorRole ?? "staff", s.actionType ?? "FILL_FORM", s.description ?? null]
      );
      createdSteps.push({ id: stepId, stepOrder: i + 1, actorRole: s.actorRole, actionType: s.actionType, description: s.description });
    }

    const workflow = await queryOne(
      `SELECT id, name, type, description, created_at AS "createdAt" FROM workflow_definitions WHERE id = $1`, [wfId]
    ) as any;

    return NextResponse.json({ data: { ...workflow, steps: createdSteps, assignments: [] } }, { status: 201 });
  } catch (error) {
    console.error("Create workflow definition error:", error);
    return NextResponse.json({ error: "Failed to create workflow definition" }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const body = await request.json();
    const { id, name, description, steps } = body;

    if (!id) return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });

    const existing = await queryOne(
      `SELECT id, name, description FROM workflow_definitions WHERE id = $1`, [id]
    ) as any;
    if (!existing)
      return NextResponse.json({ error: "Workflow definition not found" }, { status: 404 });

    await queryOne(
      `UPDATE workflow_definitions
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3`,
      [name?.trim() || existing.name, description !== undefined ? (description?.trim() || null) : existing.description, id]
    );

    // Replace steps if provided
    let updatedSteps = [];
    if (steps !== undefined) {
      const validatedSteps = validateSteps(steps);
      if (!Array.isArray(validatedSteps))
        return NextResponse.json({ error: (validatedSteps as any).error }, { status: 400 });

      await queryOne(`DELETE FROM workflow_steps WHERE workflow_id = $1`, [id]);

      for (let i = 0; i < validatedSteps.length; i++) {
        const s = validatedSteps[i];
        const stepId = randomUUID();
        await queryOne(
          `INSERT INTO workflow_steps (id, workflow_id, step_order, actor_role, action_type, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [stepId, id, i + 1, s.actorRole ?? "staff", s.actionType ?? "FILL_FORM", s.description ?? null]
        );
        updatedSteps.push({ id: stepId, stepOrder: i + 1, actorRole: s.actorRole, actionType: s.actionType, description: s.description });
      }
    } else {
      updatedSteps = await query(
        `SELECT id, step_order AS "stepOrder", actor_role AS "actorRole",
                action_type AS "actionType", description
         FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`, [id]
      ) as any[];
    }

    const workflow = await queryOne(
      `SELECT id, name, type, description, created_at AS "createdAt" FROM workflow_definitions WHERE id = $1`, [id]
    ) as any;

    return NextResponse.json({ data: { ...workflow, steps: updatedSteps } });
  } catch (error) {
    console.error("Update workflow definition error:", error);
    return NextResponse.json({ error: "Failed to update workflow definition" }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });

    await queryOne(`DELETE FROM workflow_steps WHERE workflow_id = $1`, [id]);
    await queryOne(`DELETE FROM workflow_definitions WHERE id = $1`, [id]);

    return NextResponse.json({ message: "Workflow definition deleted successfully" });
  } catch (error) {
    console.error("Delete workflow definition error:", error);
    return NextResponse.json({ error: "Failed to delete workflow definition" }, { status: 500 });
  }
}
// src/app/api/admin/workflow-definitions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

const VALID_WORKFLOW_TYPES = [
  "KPI_APPRAISAL",
  "CLASSROOM_OBSERVATION",
  "GENERIC",
];
const VALID_ACTION_TYPES = ["FILL_FORM", "ACKNOWLEDGE", "REVIEW", "APPROVE"];
const VALID_ACTOR_ROLES = [
  "admin",
  "staff",
  "manager",
  "director",
  "supervisor",
];

interface SessionUserWithRoles {
  roles?: string[];
}

interface StepInput {
  actorRole?: string;
  actionType?: string;
  description?: string | null;
}

interface WorkflowBody {
  id?: string;
  name?: string;
  type?: string;
  description?: string | null;
  steps?: unknown;
}

interface WorkflowRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
  createdAt: string | Date;
}

interface WorkflowStepRow {
  id: string;
  workflow_id: string;
  step_order: number;
  actor_role: string;
  action_type: string;
  description: string | null;
}

interface FormattedWorkflowStep {
  id: string;
  stepOrder: number;
  actorRole?: string;
  actionType?: string;
  description?: string | null;
}

interface AssignmentRow {
  id: string;
  workflow_id: string;
  departmentRoleId: string;
  rubricId: string | null;
  isActive: boolean;
  dr_role: string | null;
  dept_id: string | null;
  dept_name: string | null;
  r_id: string | null;
  r_name: string | null;
  r_type: string | null;
}

interface ExistingWorkflowRow {
  id: string;
  name: string;
  description: string | null;
}

interface ValidationError {
  error: string;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const roles = (session.user as SessionUserWithRoles).roles ?? [];
  if (!roles.includes("admin")) return { error: "Forbidden", status: 403 };
  return { session };
}

function validateSteps(steps: unknown): StepInput[] | ValidationError {
  if (!Array.isArray(steps)) return [];
  const stepInputs = steps as StepInput[];
  for (const step of stepInputs) {
    if (step.actorRole && !VALID_ACTOR_ROLES.includes(step.actorRole))
      return { error: `Invalid actor role: ${step.actorRole}` };
    if (step.actionType && !VALID_ACTION_TYPES.includes(step.actionType))
      return { error: `Invalid action type: ${step.actionType}` };
  }
  return stepInputs;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status },
      );

    const workflows = await query<WorkflowRow>(
      `SELECT id, name, type, description, created_at AS "createdAt"
       FROM workflow_definitions
       ORDER BY created_at DESC`,
    );

    // Fetch steps for all workflows
    const wfIds = workflows.map((workflow) => workflow.id);
    const stepsMap: Record<string, FormattedWorkflowStep[]> = {};
    if (wfIds.length > 0) {
      const steps = await query<WorkflowStepRow>(
        `SELECT * FROM workflow_steps WHERE workflow_id = ANY($1) ORDER BY step_order ASC`,
        [wfIds],
      );
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

    // Fetch assignments for all workflows
    const assignmentsMap: Record<string, Record<string, unknown>[]> = {};
    if (wfIds.length > 0) {
      const assignments = await query<AssignmentRow>(
        `SELECT rwa.id, rwa.workflow_id, rwa.department_role_id AS "departmentRoleId",
                rwa.rubric_id AS "rubricId", rwa.is_active AS "isActive",
                dr.role AS dr_role, d.id AS dept_id, d.name AS dept_name,
                rt.id AS r_id, rt.name AS r_name, rt.template_type AS r_type
         FROM role_workflow_assignments rwa
         LEFT JOIN department_roles dr ON dr.id = rwa.department_role_id
         LEFT JOIN departments d ON d.id = dr.department_id
         LEFT JOIN rubric_templates rt ON rt.id = rwa.rubric_id
         WHERE rwa.workflow_id = ANY($1)`,
        [wfIds],
      );
      for (const a of assignments) {
        if (!assignmentsMap[a.workflow_id]) assignmentsMap[a.workflow_id] = [];
        assignmentsMap[a.workflow_id].push({
          id: a.id,
          departmentRoleId: a.departmentRoleId,
          rubricId: a.rubricId,
          isActive: a.isActive,
          departmentRole: a.dr_role
            ? {
                id: a.departmentRoleId,
                role: a.dr_role,
                department: a.dept_id
                  ? { id: a.dept_id, name: a.dept_name }
                  : null,
              }
            : null,
          rubric: a.r_id
            ? { id: a.r_id, name: a.r_name, templateType: a.r_type }
            : null,
        });
      }
    }

    const result = workflows.map((workflow) => ({
      ...workflow,
      steps: stepsMap[workflow.id] ?? [],
      assignments: assignmentsMap[workflow.id] ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Workflow definitions GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow definitions" },
      { status: 500 },
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status },
      );

    const body = (await request.json()) as WorkflowBody;
    const { name, type, description, steps } = body;

    if (!name?.trim())
      return NextResponse.json(
        { error: "Workflow name is required" },
        { status: 400 },
      );
    if (!type || !VALID_WORKFLOW_TYPES.includes(type))
      return NextResponse.json(
        { error: "Invalid workflow type" },
        { status: 400 },
      );

    const validatedSteps = validateSteps(steps);
    if (!Array.isArray(validatedSteps))
      return NextResponse.json(
        { error: validatedSteps.error },
        { status: 400 },
      );

    const wfId = randomUUID();
    await queryOne(
      `INSERT INTO workflow_definitions (id, name, type, description)
       VALUES ($1, $2, $3, $4)`,
      [wfId, name.trim(), type, description?.trim() || null],
    );

    // Insert steps
    const createdSteps: FormattedWorkflowStep[] = [];
    for (let i = 0; i < validatedSteps.length; i++) {
      const s = validatedSteps[i];
      const stepId = randomUUID();
      await queryOne(
        `INSERT INTO workflow_steps (id, workflow_id, step_order, actor_role, action_type, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          stepId,
          wfId,
          i + 1,
          s.actorRole ?? "staff",
          s.actionType ?? "FILL_FORM",
          s.description ?? null,
        ],
      );
      createdSteps.push({
        id: stepId,
        stepOrder: i + 1,
        actorRole: s.actorRole,
        actionType: s.actionType,
        description: s.description,
      });
    }

    const workflow = await queryOne<WorkflowRow>(
      `SELECT id, name, type, description, created_at AS "createdAt" FROM workflow_definitions WHERE id = $1`,
      [wfId],
    );

    return NextResponse.json(
      { data: { ...workflow, steps: createdSteps, assignments: [] } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create workflow definition error:", error);
    return NextResponse.json(
      { error: "Failed to create workflow definition" },
      { status: 500 },
    );
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status },
      );

    const body = (await request.json()) as WorkflowBody;
    const { id, name, description, steps } = body;

    if (!id)
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );

    const existing = await queryOne<ExistingWorkflowRow>(
      `SELECT id, name, description FROM workflow_definitions WHERE id = $1`,
      [id],
    );
    if (!existing)
      return NextResponse.json(
        { error: "Workflow definition not found" },
        { status: 404 },
      );

    await queryOne(
      `UPDATE workflow_definitions
       SET name = $1, description = $2
       WHERE id = $3`,
      [
        name?.trim() || existing.name,
        description !== undefined
          ? description?.trim() || null
          : existing.description,
        id,
      ],
    );

    // Replace steps if provided
    let updatedSteps: FormattedWorkflowStep[] = [];
    if (steps !== undefined) {
      const validatedSteps = validateSteps(steps);
      if (!Array.isArray(validatedSteps))
        return NextResponse.json(
          { error: validatedSteps.error },
          { status: 400 },
        );

      await queryOne(`DELETE FROM workflow_steps WHERE workflow_id = $1`, [id]);

      for (let i = 0; i < validatedSteps.length; i++) {
        const s = validatedSteps[i];
        const stepId = randomUUID();
        await queryOne(
          `INSERT INTO workflow_steps (id, workflow_id, step_order, actor_role, action_type, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            stepId,
            id,
            i + 1,
            s.actorRole ?? "staff",
            s.actionType ?? "FILL_FORM",
            s.description ?? null,
          ],
        );
        updatedSteps.push({
          id: stepId,
          stepOrder: i + 1,
          actorRole: s.actorRole,
          actionType: s.actionType,
          description: s.description,
        });
      }
    } else {
      updatedSteps = await query<FormattedWorkflowStep>(
        `SELECT id, step_order AS "stepOrder", actor_role AS "actorRole",
                action_type AS "actionType", description
         FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`,
        [id],
      );
    }

    const workflow = await queryOne<WorkflowRow>(
      `SELECT id, name, type, description, created_at AS "createdAt" FROM workflow_definitions WHERE id = $1`,
      [id],
    );

    return NextResponse.json({ data: { ...workflow, steps: updatedSteps } });
  } catch (error) {
    console.error("Update workflow definition error:", error);
    return NextResponse.json(
      { error: "Failed to update workflow definition" },
      { status: 500 },
    );
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status },
      );

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );

    await queryOne(`DELETE FROM workflow_steps WHERE workflow_id = $1`, [id]);
    await queryOne(`DELETE FROM workflow_definitions WHERE id = $1`, [id]);

    return NextResponse.json({
      message: "Workflow definition deleted successfully",
    });
  } catch (error) {
    console.error("Delete workflow definition error:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow definition" },
      { status: 500 },
    );
  }
}

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { pool, query, queryOne } from "@/lib/db";
import {
  GET as listObservationsRoute,
  POST as createObservationRoute,
} from "@/app/api/observations/route";
import { GET as observationSummaryRoute } from "@/app/api/observations/summary/route";
import {
  DELETE as deleteObservationRoute,
  GET as getObservationRoute,
  PATCH as updateObservationRoute,
} from "@/app/api/observations/[id]/route";
import { PUT as saveAnswerRoute } from "@/app/api/observations/[id]/answers/[indicatorId]/route";
import { PATCH as submitObservationRoute } from "@/app/api/observations/[id]/submit/route";
import { PATCH as acknowledgeObservationRoute } from "@/app/api/observations/[id]/acknowledge/route";
import { PATCH as reopenObservationRoute } from "@/app/api/observations/[id]/reopen/route";
import { GET as listCreationStaffRoute } from "@/app/api/observations/staff/route";
import { GET as listAvailableFormsRoute } from "@/app/api/observations/available-forms/route";
import { setObservationTestActor } from "./auth";
import { observationListQuerySchema } from "../schemas";
import type {
  ObservationActor,
  ObservationSummaryCounts,
} from "../types";
import {
  queryObservationList,
  queryObservationSummary,
} from "./queries";
import {
  processObservationAcknowledgementAutomation as processObservationAcknowledgementAutomationRuntime,
  type ObservationAutomationOptions,
} from "./processAcknowledgementAutomation";
import {
  DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
  getObservationNotificationSettings,
  updateObservationNotificationSettings,
  type ObservationNotificationSettings,
} from "./notificationSettings";
import {
  OBSERVATION_SCHEDULER_ADVISORY_LOCK,
  runObservationAcknowledgementSchedulerOnce,
} from "./observationAcknowledgementScheduler";

interface Fixture {
  prefix: string;
  departmentAId: string;
  departmentBId: string;
  rubricId: string;
  managerA: ObservationActor;
  managerB: ObservationActor;
  staffA: ObservationActor;
  staffB: ObservationActor;
  director: ObservationActor;
  admin: ObservationActor;
  observationIds: string[];
}

const AUTOMATION_SETTINGS: ObservationNotificationSettings = {
  ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
};

function processObservationAcknowledgementAutomation(
  now: Date,
  options: ObservationAutomationOptions = {},
) {
  return processObservationAcknowledgementAutomationRuntime(now, {
    settings: AUTOMATION_SETTINGS,
    ...options,
  });
}

const countsKeys: Array<keyof ObservationSummaryCounts> = [
  "draft",
  "awaitingAcknowledgement",
  "completed",
  "actionRequired",
  "overdue",
  "stale",
  "completedThisMonth",
];

function listInput(overrides: Record<string, unknown> = {}) {
  return observationListQuerySchema.parse({
    q: overrides.q ?? "",
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 20,
    ...overrides,
  });
}

async function insertFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const prefix = `phase1-${suffix}`;
  const departmentAId = randomUUID();
  const departmentBId = randomUUID();
  const rubricId = randomUUID();
  const sectionId = randomUUID();
  const requiredIndicatorId = randomUUID();
  const optionalIndicatorId = randomUUID();
  const managerAId = randomUUID();
  const managerBId = randomUUID();
  const staffAId = randomUUID();
  const staffBId = randomUUID();
  const directorId = randomUUID();
  const adminId = randomUUID();

  await query(
    `INSERT INTO departments (id, name, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW()), ($3, $4, NOW(), NOW())`,
    [departmentAId, `${prefix}-department-a`, departmentBId, `${prefix}-department-b`],
  );

  const users = [
    [managerAId, `${prefix}-manager-a@example.test`, "manager", departmentAId],
    [managerBId, `${prefix}-manager-b@example.test`, "manager", departmentBId],
    [staffAId, `${prefix}-staff-a@example.test`, "staff", departmentAId],
    [staffBId, `${prefix}-staff-b@example.test`, "staff", departmentBId],
    [directorId, `${prefix}-director@example.test`, "director", departmentAId],
    [adminId, `${prefix}-admin@example.test`, "admin", departmentAId],
  ] as const;

  for (const [userId, email, role, departmentId] of users) {
    await query(
      `INSERT INTO users
         (id, email, password_hash, email_verified, status, created_at, updated_at)
       VALUES ($1, $2, 'integration-test', true, 'active', NOW(), NOW())`,
      [userId, email],
    );
    await query(
      `INSERT INTO profiles
         (id, user_id, email, full_name, department_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [randomUUID(), userId, email, `${prefix}-${role}`, departmentId],
    );
    await query(
      `INSERT INTO user_roles (id, user_id, role)
       VALUES ($1, $2, $3)`,
      [randomUUID(), userId, role],
    );
  }

  await query(
    `INSERT INTO rubric_templates
       (id, name, description, department_id, is_global, is_active, created_by,
        created_at, updated_at, template_type)
     VALUES ($1, $2, $3, $4, false, true, $5, NOW(), NOW(), 'CLASSROOM_OBSERVATION')`,
    [rubricId, `${prefix}-rubric`, "Phase 1 integration fixture", departmentAId, adminId],
  );
  await query(
    `INSERT INTO rubric_sections (id, template_id, name, weight, sort_order, created_at)
     VALUES ($1, $2, $3, 100, 0, NOW())`,
    [sectionId, rubricId, `${prefix}-section`],
  );
  await query(
    `INSERT INTO rubric_indicators
       (id, section_id, name, sort_order, question_type, is_required, created_at)
     VALUES
       ($1, $3, $4, 0, 'SCALE', true, NOW()),
       ($2, $3, $5, 1, 'TEXT', false, NOW())`,
    [
      requiredIndicatorId,
      optionalIndicatorId,
      sectionId,
      `${prefix}-required`,
      `${prefix}-optional`,
    ],
  );

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const stale = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2, 12));
  const observationIds: string[] = [];

  const records = [
    {
      title: `${prefix}-01-overdue-draft`,
      staffId: staffAId,
      managerId: managerAId,
      status: "draft",
      observationDate: now,
      dueAt: yesterday,
      updatedAt: stale,
      submittedAt: null,
      acknowledgedAt: null,
    },
    {
      title: `${prefix}-02-submitted`,
      staffId: staffAId,
      managerId: managerAId,
      status: "submitted",
      observationDate: now,
      dueAt: tomorrow,
      updatedAt: now,
      submittedAt: now,
      acknowledgedAt: null,
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      title: `${prefix}-${String(index + 3).padStart(2, "0")}-acknowledged`,
      staffId: staffAId,
      managerId: managerAId,
      status: "acknowledged",
      observationDate: now,
      dueAt: tomorrow,
      updatedAt: new Date(now.getTime() - index * 1000),
      submittedAt: currentMonth,
      acknowledgedAt: currentMonth,
    })),
    {
      title: `${prefix}-11-other-manager-draft`,
      staffId: staffBId,
      managerId: managerBId,
      status: "draft",
      observationDate: now,
      dueAt: tomorrow,
      updatedAt: now,
      submittedAt: null,
      acknowledgedAt: null,
    },
    {
      title: `${prefix}-12-outside-date`,
      staffId: staffBId,
      managerId: managerBId,
      status: "acknowledged",
      observationDate: new Date("2020-01-15T12:00:00.000Z"),
      dueAt: new Date("2020-01-20T12:00:00.000Z"),
      updatedAt: new Date("2020-01-20T12:00:00.000Z"),
      submittedAt: new Date("2020-01-19T12:00:00.000Z"),
      acknowledgedAt: new Date("2020-01-20T12:00:00.000Z"),
    },
  ] as const;

  for (const record of records) {
    const observationId = randomUUID();
    observationIds.push(observationId);
    await query(
      `INSERT INTO observations
         (id, "staffId", "managerId", template_id, status, type, title, description,
          created_at, updated_at, observation_date, due_at, submitted_at, acknowledged_at)
       VALUES ($1, $2, $3, $4, $5, 'MANAGER', $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        observationId,
        record.staffId,
        record.managerId,
        rubricId,
        record.status,
        record.title,
        "Phase 1 integration fixture",
        record.updatedAt,
        record.updatedAt,
        record.observationDate,
        record.dueAt,
        record.submittedAt,
        record.acknowledgedAt,
      ],
    );
  }

  await query(
    `INSERT INTO observation_answers
       (id, observation_id, indicator_id, score, note, created_at, updated_at)
     VALUES ($1, $2, $3, 4, 'complete', NOW(), NOW())`,
    [randomUUID(), observationIds[0], requiredIndicatorId],
  );

  return {
    prefix,
    departmentAId,
    departmentBId,
    rubricId,
    managerA: { id: managerAId, roles: ["manager"] },
    managerB: { id: managerBId, roles: ["manager"] },
    staffA: { id: staffAId, roles: ["staff"] },
    staffB: { id: staffBId, roles: ["staff"] },
    director: { id: directorId, roles: ["director"] },
    admin: { id: adminId, roles: ["admin"] },
    observationIds,
  };
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  await query(`DELETE FROM observations WHERE id::text = ANY($1::text[])`, [fixture.observationIds]);
  await query(`DELETE FROM rubric_templates WHERE id::text = $1`, [fixture.rubricId]);
  await query(
    `DELETE FROM users WHERE id::text = ANY($1::text[])`,
    [[
      fixture.managerA.id,
      fixture.managerB.id,
      fixture.staffA.id,
      fixture.staffB.id,
      fixture.director.id,
      fixture.admin.id,
    ]],
  );
  await query(`DELETE FROM departments WHERE id::text = ANY($1::text[])`, [
    [fixture.departmentAId, fixture.departmentBId],
  ]);
}

async function insertAutomationObservation(
  fixture: Fixture,
  input: {
    submittedAt: Date;
    automationStartedAt?: Date;
    status?: "draft" | "submitted" | "acknowledged";
    acknowledgedAt?: Date | null;
  },
): Promise<string> {
  const id = randomUUID();
  fixture.observationIds.push(id);
  await query(
    `INSERT INTO observations
       (id, "staffId", "managerId", template_id, status, type, title, description,
        created_at, updated_at, submitted_at, acknowledged_at,
        acknowledgement_automation_started_at)
     VALUES ($1, $2, $3, $4, $5, 'MANAGER', $6, 'Automation integration fixture',
             NOW(), NOW(), $7, $8, $9)`,
    [
      id,
      fixture.staffA.id,
      fixture.managerA.id,
      fixture.rubricId,
      input.status ?? "submitted",
      `${fixture.prefix}-automation-${id}`,
      input.submittedAt,
      input.acknowledgedAt ?? null,
      input.automationStartedAt ?? input.submittedAt,
    ],
  );
  return id;
}

function assertCountDelta(
  before: ObservationSummaryCounts,
  after: ObservationSummaryCounts,
  expected: Partial<ObservationSummaryCounts>,
): void {
  for (const key of countsKeys) {
    assert.equal(
      after[key] - before[key],
      expected[key] ?? 0,
      `unexpected ${key} delta`,
    );
  }
}

test("Phase 1 list and summary queries enforce role scope, filters, pagination, and privacy", async () => {
  let fixture: Fixture | null = null;
  try {
    const temporaryActors = {
      admin: { id: randomUUID(), roles: ["admin"] } satisfies ObservationActor,
      director: { id: randomUUID(), roles: ["director"] } satisfies ObservationActor,
      manager: { id: randomUUID(), roles: ["manager"] } satisfies ObservationActor,
      staff: { id: randomUUID(), roles: ["staff"] } satisfies ObservationActor,
    };
    const baseline = {
      admin: (await queryObservationSummary(temporaryActors.admin)).counts,
      director: (await queryObservationSummary(temporaryActors.director)).counts,
      manager: (await queryObservationSummary(temporaryActors.manager)).counts,
      staff: (await queryObservationSummary(temporaryActors.staff)).counts,
    };

    fixture = await insertFixture();
    const all = listInput({ q: fixture.prefix });

    const [adminList, directorList, managerList, staffList, managerBList, staffBList] =
      await Promise.all([
        queryObservationList(fixture.admin, all),
        queryObservationList(fixture.director, all),
        queryObservationList(fixture.managerA, all),
        queryObservationList(fixture.staffA, all),
        queryObservationList(fixture.managerB, all),
        queryObservationList(fixture.staffB, all),
      ]);

    assert.equal(adminList.pagination.total, 12);
    assert.equal(directorList.pagination.total, 12);
    assert.equal(managerList.pagination.total, 10);
    assert.equal(staffList.pagination.total, 9);
    assert.equal(managerBList.pagination.total, 2);
    assert.equal(staffBList.pagination.total, 1);
    assert.ok(adminList.data.every((item) => !("answers" in item)));
    assert.equal(
      managerList.data.find((item) => item.title?.includes("overdue-draft"))?.progress
        ?.requiredAnswered,
      1,
    );
    assert.equal(
      staffList.data.some((item) => item.title?.includes("overdue-draft")),
      false,
    );
    assert.equal(
      directorList.data.find((item) => item.title?.includes("overdue-draft"))?.progress,
      null,
    );

    const filterCases: Array<[string, Record<string, unknown>, number]> = [
      ["status", { q: fixture.prefix, status: "draft" }, 2],
      ["staff", { q: fixture.prefix, staffId: fixture.staffA.id }, 10],
      ["manager", { q: fixture.prefix, managerId: fixture.managerB.id }, 2],
      ["department", { q: fixture.prefix, departmentId: fixture.departmentAId }, 10],
      ["rubric", { q: fixture.prefix, rubricId: fixture.rubricId }, 12],
      ["action required", { q: fixture.prefix, actionRequired: "true" }, 1],
      ["overdue", { q: fixture.prefix, overdue: "true" }, 1],
    ];
    for (const [name, input, expected] of filterCases) {
      const result = await queryObservationList(fixture.admin, listInput(input));
      assert.equal(result.pagination.total, expected, `${name} filter`);
    }

    const managerMe = await queryObservationList(
      fixture.managerA,
      listInput({ q: fixture.prefix, managerId: "me" }),
    );
    assert.equal(managerMe.pagination.total, 10);

    const today = new Date().toISOString().slice(0, 10);
    const dateRange = await queryObservationList(
      fixture.admin,
      listInput({ q: fixture.prefix, from: today, to: today }),
    );
    assert.equal(dateRange.pagination.total, 11);

    const pageOne = await queryObservationList(
      fixture.admin,
      listInput({ q: fixture.prefix, page: 1, pageSize: 10, sort: "created_asc" }),
    );
    const pageTwo = await queryObservationList(
      fixture.admin,
      listInput({ q: fixture.prefix, page: 2, pageSize: 10, sort: "created_asc" }),
    );
    assert.deepEqual(pageOne.pagination, {
      page: 1,
      pageSize: 10,
      total: 12,
      totalPages: 2,
    });
    assert.equal(pageOne.data.length, 10);
    assert.equal(pageTwo.data.length, 2);
    assert.equal(
      new Set([...pageOne.data, ...pageTwo.data].map((item) => item.id)).size,
      12,
    );

    const dueAscending = await queryObservationList(
      fixture.admin,
      listInput({ q: fixture.prefix, sort: "due_asc" }),
    );
    assert.ok(
      Date.parse(dueAscending.data[0]!.dueAt!) <=
        Date.parse(dueAscending.data.at(-1)!.dueAt!),
    );

    const [adminSummary, directorSummary, managerSummary, staffSummary] =
      await Promise.all([
        queryObservationSummary(fixture.admin),
        queryObservationSummary(fixture.director),
        queryObservationSummary(fixture.managerA),
        queryObservationSummary(fixture.staffA),
      ]);

    assertCountDelta(baseline.admin, adminSummary.counts, {
      draft: 2,
      awaitingAcknowledgement: 1,
      completed: 9,
      actionRequired: 1,
      overdue: 1,
      stale: 1,
      completedThisMonth: 8,
    });
    assertCountDelta(baseline.director, directorSummary.counts, {
      draft: 2,
      awaitingAcknowledgement: 1,
      completed: 9,
      actionRequired: 1,
      overdue: 1,
      stale: 1,
      completedThisMonth: 8,
    });
    assertCountDelta(baseline.manager, managerSummary.counts, {
      draft: 1,
      awaitingAcknowledgement: 1,
      completed: 8,
      actionRequired: 1,
      overdue: 1,
      stale: 1,
      completedThisMonth: 8,
    });
    assertCountDelta(baseline.staff, staffSummary.counts, {
      awaitingAcknowledgement: 1,
      completed: 8,
      actionRequired: 1,
      completedThisMonth: 8,
    });
    assert.equal(
      [...staffSummary.needsAttention, ...staffSummary.recent].some((item) =>
        item.title?.includes("overdue-draft"),
      ),
      false,
    );

    for (const summary of [adminSummary, directorSummary, managerSummary, staffSummary]) {
      assert.ok(summary.needsAttention.length <= 5);
      assert.ok(summary.recent.length <= 5);
      assert.deepEqual(
        summary.pipeline.map((item) => item.count),
        [
          summary.counts.draft,
          summary.counts.awaitingAcknowledgement,
          summary.counts.completed,
        ],
      );
    }
  } finally {
    if (fixture) await cleanupFixture(fixture);
  }
});

interface WorkflowFixture {
  prefix: string;
  departmentAId: string;
  departmentBId: string;
  rubricAId: string;
  rubricBId: string;
  workflowAId: string;
  requiredIndicatorId: string;
  optionalIndicatorId: string;
  managerA: ObservationActor;
  managerB: ObservationActor;
  staffA: ObservationActor;
  staffB: ObservationActor;
  admin: ObservationActor;
  userIds: string[];
  observationIds: string[];
}

async function insertWorkflowFixture(): Promise<WorkflowFixture> {
  const prefix = `phase6-${randomUUID()}`;
  const departmentAId = randomUUID();
  const departmentBId = randomUUID();
  const rubricAId = randomUUID();
  const rubricBId = randomUUID();
  const workflowAId = randomUUID();
  const workflowBId = randomUUID();
  const departmentRoleAId = randomUUID();
  const departmentRoleBId = randomUUID();
  const sectionAId = randomUUID();
  const sectionBId = randomUUID();
  const requiredIndicatorId = randomUUID();
  const optionalIndicatorId = randomUUID();
  const managerAId = randomUUID();
  const managerBId = randomUUID();
  const staffAId = randomUUID();
  const staffBId = randomUUID();
  const adminId = randomUUID();
  const userIds = [managerAId, managerBId, staffAId, staffBId, adminId];

  await query(
    `INSERT INTO departments (id, name, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW()), ($3, $4, NOW(), NOW())`,
    [departmentAId, `${prefix}-department-a`, departmentBId, `${prefix}-department-b`],
  );

  const users = [
    [managerAId, `${prefix}-manager-a@example.test`, "manager", departmentAId],
    [managerBId, `${prefix}-manager-b@example.test`, "manager", departmentBId],
    [staffAId, `${prefix}-staff-a@example.test`, "staff", departmentAId],
    [staffBId, `${prefix}-staff-b@example.test`, "staff", departmentBId],
    [adminId, `${prefix}-admin@example.test`, "admin", departmentAId],
  ] as const;
  for (const [userId, email, role, departmentId] of users) {
    await query(
      `INSERT INTO users
         (id, email, password_hash, email_verified, status, created_at, updated_at)
       VALUES ($1, $2, 'integration-test', true, 'active', NOW(), NOW())`,
      [userId, email],
    );
    await query(
      `INSERT INTO profiles
         (id, user_id, email, full_name, department_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [randomUUID(), userId, email, `${prefix}-${role}`, departmentId],
    );
    await query(
      `INSERT INTO user_roles (id, user_id, role)
       VALUES ($1, $2, $3)`,
      [randomUUID(), userId, role],
    );
  }

  await query(
    `INSERT INTO department_roles
       (id, department_id, role, name, created_at, updated_at)
     VALUES
       ($1, $2, 'staff', $3, NOW(), NOW()),
       ($4, $5, 'staff', $6, NOW(), NOW())`,
    [
      departmentRoleAId,
      departmentAId,
      `${prefix}-staff-role-a`,
      departmentRoleBId,
      departmentBId,
      `${prefix}-staff-role-b`,
    ],
  );
  await query(
    `INSERT INTO workflow_definitions (id, name, type, description, created_at)
     VALUES
       ($1, $2, 'CLASSROOM_OBSERVATION', $3, NOW()),
       ($4, $5, 'CLASSROOM_OBSERVATION', $6, NOW())`,
    [
      workflowAId,
      `${prefix}-workflow-a`,
      "Phase 6 route integration workflow A",
      workflowBId,
      `${prefix}-workflow-b`,
      "Phase 6 route integration workflow B",
    ],
  );
  await query(
    `INSERT INTO rubric_templates
       (id, name, description, department_id, is_global, is_active, created_by,
        created_at, updated_at, template_type)
     VALUES
       ($1, $2, $3, $4, false, true, $5, NOW(), NOW(), 'CLASSROOM_OBSERVATION'),
       ($6, $7, $8, $9, false, true, $5, NOW(), NOW(), 'CLASSROOM_OBSERVATION')`,
    [
      rubricAId,
      `${prefix}-rubric-a`,
      "Assigned to department A staff",
      departmentAId,
      adminId,
      rubricBId,
      `${prefix}-rubric-b`,
      "Assigned to department B staff",
      departmentBId,
    ],
  );
  await query(
    `INSERT INTO rubric_sections (id, template_id, name, weight, sort_order, created_at)
     VALUES
       ($1, $2, $3, 100, 0, NOW()),
       ($4, $5, $6, 100, 0, NOW())`,
    [sectionAId, rubricAId, `${prefix}-section-a`, sectionBId, rubricBId, `${prefix}-section-b`],
  );
  await query(
    `INSERT INTO rubric_indicators
       (id, section_id, name, sort_order, question_type, is_required, created_at)
     VALUES
       ($1, $3, $4, 0, 'SCALE', true, NOW()),
       ($2, $3, $5, 1, 'TEXT', false, NOW()),
       ($6, $7, $8, 0, 'SCALE', true, NOW())`,
    [
      requiredIndicatorId,
      optionalIndicatorId,
      sectionAId,
      `${prefix}-required`,
      `${prefix}-optional`,
      randomUUID(),
      sectionBId,
      `${prefix}-other-required`,
    ],
  );
  await query(
    `INSERT INTO role_workflow_assignments
       (id, department_role_id, workflow_id, rubric_id, is_active, created_at)
     VALUES
       ($1, $2, $3, $4, true, NOW()),
       ($5, $6, $7, $8, true, NOW())`,
    [
      randomUUID(),
      departmentRoleAId,
      workflowAId,
      rubricAId,
      randomUUID(),
      departmentRoleBId,
      workflowBId,
      rubricBId,
    ],
  );

  return {
    prefix,
    departmentAId,
    departmentBId,
    rubricAId,
    rubricBId,
    workflowAId,
    requiredIndicatorId,
    optionalIndicatorId,
    managerA: { id: managerAId, roles: ["manager"] },
    managerB: { id: managerBId, roles: ["manager"] },
    staffA: { id: staffAId, roles: ["staff"] },
    staffB: { id: staffBId, roles: ["staff"] },
    admin: { id: adminId, roles: ["admin"] },
    userIds,
    observationIds: [],
  };
}

async function cleanupWorkflowFixture(fixture: WorkflowFixture): Promise<void> {
  if (fixture.observationIds.length > 0) {
    await query(`DELETE FROM observations WHERE id::text = ANY($1::text[])`, [fixture.observationIds]);
  }
  await query(`DELETE FROM rubric_templates WHERE id::text = ANY($1::text[])`, [
    [fixture.rubricAId, fixture.rubricBId],
  ]);
  await query(
    `DELETE FROM role_workflow_assignments
     WHERE workflow_id IN (SELECT id FROM workflow_definitions WHERE name LIKE $1)`,
    [`${fixture.prefix}%`],
  );
  await query(`DELETE FROM workflow_definitions WHERE name LIKE $1`, [
    `${fixture.prefix}%`,
  ]);
  await query(`DELETE FROM users WHERE id::text = ANY($1::text[])`, [fixture.userIds]);
  await query(`DELETE FROM departments WHERE id::text = ANY($1::text[])`, [
    [fixture.departmentAId, fixture.departmentBId],
  ]);
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseBody<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

test("draft and pending observations can be deleted, but completed observations are retained", async () => {
  let fixture: WorkflowFixture | null = null;
  try {
    fixture = await insertWorkflowFixture();
    const managerDraftId = randomUUID();
    const adminDraftId = randomUUID();
    const submittedId = randomUUID();
    const acknowledgedId = randomUUID();
    fixture.observationIds.push(
      managerDraftId,
      adminDraftId,
      submittedId,
      acknowledgedId,
    );

    await query(
      `INSERT INTO observations
         (id, "staffId", "managerId", template_id, status, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 'draft', NOW(), NOW()),
         ($5, $2, $3, $4, 'draft', NOW(), NOW()),
         ($6, $2, $3, $4, 'submitted', NOW(), NOW()),
         ($7, $2, $3, $4, 'acknowledged', NOW(), NOW())`,
      [
        managerDraftId,
        fixture.staffA.id,
        fixture.managerA.id,
        fixture.rubricAId,
        adminDraftId,
        submittedId,
        acknowledgedId,
      ],
    );

    setObservationTestActor(fixture.managerB);
    const forbiddenResponse = await deleteObservationRoute(
      jsonRequest(`http://localhost/api/observations/${managerDraftId}`, "DELETE"),
      { params: Promise.resolve({ id: managerDraftId }) },
    );
    assert.equal(forbiddenResponse.status, 403);

    setObservationTestActor(fixture.managerA);
    const managerDeleteResponse = await deleteObservationRoute(
      jsonRequest(`http://localhost/api/observations/${managerDraftId}`, "DELETE"),
      { params: Promise.resolve({ id: managerDraftId }) },
    );
    assert.equal(managerDeleteResponse.status, 200);
    assert.equal(
      await queryOne(`SELECT id FROM observations WHERE id = $1`, [managerDraftId]),
      null,
    );

    const submittedResponse = await deleteObservationRoute(
      jsonRequest(`http://localhost/api/observations/${submittedId}`, "DELETE"),
      { params: Promise.resolve({ id: submittedId }) },
    );
    assert.equal(submittedResponse.status, 200);
    assert.equal(
      await queryOne(`SELECT id FROM observations WHERE id = $1`, [submittedId]),
      null,
    );

    const completedResponse = await deleteObservationRoute(
      jsonRequest(`http://localhost/api/observations/${acknowledgedId}`, "DELETE"),
      { params: Promise.resolve({ id: acknowledgedId }) },
    );
    assert.equal(completedResponse.status, 409);

    setObservationTestActor(fixture.admin);
    const adminDeleteResponse = await deleteObservationRoute(
      jsonRequest(`http://localhost/api/observations/${adminDraftId}`, "DELETE"),
      { params: Promise.resolve({ id: adminDraftId }) },
    );
    assert.equal(adminDeleteResponse.status, 200);
    assert.equal(
      await queryOne(`SELECT id FROM observations WHERE id = $1`, [adminDraftId]),
      null,
    );
  } finally {
    setObservationTestActor(null);
    if (fixture) await cleanupWorkflowFixture(fixture);
  }
});

test("Phase 6 routes enforce creation rules, privacy, lifecycle, reassignment, and canonical response fields", async () => {
  let fixture: WorkflowFixture | null = null;
  try {
    fixture = await insertWorkflowFixture();
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    setObservationTestActor(fixture.staffA);
    const baselineStaffSummaryResponse = await observationSummaryRoute();
    assert.equal(baselineStaffSummaryResponse.status, 200);
    const baselineStaffSummary = await responseBody<{
      counts: ObservationSummaryCounts;
      needsAttention: Array<{ id: string }>;
      recent: Array<{ id: string }>;
    }>(baselineStaffSummaryResponse);

    setObservationTestActor(fixture.managerA);
    const managerStaffResponse = await listCreationStaffRoute();
    assert.equal(managerStaffResponse.status, 200);
    const managerStaff = await responseBody<Array<{ id: string }>>(managerStaffResponse);
    assert.deepEqual(managerStaff.map((person) => person.id), [fixture.staffA.id]);

    const forbiddenForms = await listAvailableFormsRoute(
      jsonRequest(
        `http://localhost/api/observations/available-forms?staffId=${fixture.staffB.id}`,
        "GET",
      ),
    );
    assert.equal(forbiddenForms.status, 403);

    const invalidCombination = await createObservationRoute(
      jsonRequest("http://localhost/api/observations", "POST", {
        staffId: fixture.staffA.id,
        rubricId: fixture.rubricBId,
        dueAt,
      }),
    );
    assert.equal(invalidCombination.status, 403);

    const wrongDepartment = await createObservationRoute(
      jsonRequest("http://localhost/api/observations", "POST", {
        staffId: fixture.staffB.id,
        rubricId: fixture.rubricBId,
        dueAt,
      }),
    );
    assert.equal(wrongDepartment.status, 403);

    const createdResponse = await createObservationRoute(
      jsonRequest("http://localhost/api/observations", "POST", {
        staffId: fixture.staffA.id,
        rubricId: fixture.rubricAId,
        workflowId: fixture.workflowAId,
        dueAt,
        title: `${fixture.prefix}-workflow`,
      }),
    );
    assert.equal(createdResponse.status, 201);
    const created = await responseBody<{ observation: { id: string; manager: { id: string } } }>(
      createdResponse,
    );
    fixture.observationIds.push(created.observation.id);
    assert.equal(
      created.observation.manager.id,
      fixture.managerA.id,
      "the authenticated creator must be assigned as the observer",
    );

    const spoofedAssignmentResponse = await createObservationRoute(
      jsonRequest("http://localhost/api/observations", "POST", {
        staffId: fixture.staffA.id,
        rubricId: fixture.rubricAId,
        workflowId: fixture.workflowAId,
        managerId: fixture.managerB.id,
        dueAt,
        title: `${fixture.prefix}-spoofed-assignment`,
      }),
    );
    assert.equal(spoofedAssignmentResponse.status, 201);
    const spoofedAssignment = await responseBody<{
      observation: { id: string; manager: { id: string } };
    }>(spoofedAssignmentResponse);
    assert.equal(
      spoofedAssignment.observation.manager.id,
      fixture.managerA.id,
      "a client-supplied managerId must not override the authenticated observer",
    );
    await query(`DELETE FROM observations WHERE id = $1`, [spoofedAssignment.observation.id]);

    await query(
      `INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, 'staff')`,
      [randomUUID(), fixture.admin.id],
    );
    try {
      setObservationTestActor(fixture.admin);
      const adminSelfObservationResponse = await createObservationRoute(
        jsonRequest("http://localhost/api/observations", "POST", {
          staffId: fixture.admin.id,
          rubricId: fixture.rubricAId,
          workflowId: fixture.workflowAId,
          dueAt,
        }),
      );
      assert.equal(adminSelfObservationResponse.status, 400);
      assert.deepEqual(await responseBody(adminSelfObservationResponse), {
        error: "You cannot create an observation for yourself.",
      });
    } finally {
      await query(`DELETE FROM user_roles WHERE user_id = $1 AND role = 'staff'`, [
        fixture.admin.id,
      ]);
    }

    setObservationTestActor(fixture.staffA);
    const privateDraftResponse = await getObservationRoute(
      new NextRequest(`http://localhost/api/observations/${created.observation.id}`),
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(privateDraftResponse.status, 403);
    assert.deepEqual(await responseBody(privateDraftResponse), { error: "Forbidden." });

    const draftListResponse = await listObservationsRoute(
      new Request(
        `http://localhost/api/observations?q=${encodeURIComponent(fixture.prefix)}&page=1&pageSize=10`,
      ),
    );
    assert.equal(draftListResponse.status, 200);
    const draftList = await responseBody<{
      data: Array<{ id: string }>;
      pagination: { total: number; totalPages: number };
      summary: ObservationSummaryCounts;
    }>(draftListResponse);
    assert.deepEqual(draftList.data, []);
    assert.equal(draftList.pagination.total, 0);
    assert.equal(draftList.pagination.totalPages, 0);
    assert.equal(draftList.summary.draft, 0);

    const draftSummaryResponse = await observationSummaryRoute();
    assert.equal(draftSummaryResponse.status, 200);
    const draftSummary = await responseBody<{
      counts: ObservationSummaryCounts;
      needsAttention: Array<{ id: string }>;
      recent: Array<{ id: string }>;
    }>(draftSummaryResponse);
    assert.deepEqual(draftSummary.counts, baselineStaffSummary.counts);
    assert.equal(
      [...draftSummary.needsAttention, ...draftSummary.recent].some(
        (item) => item.id === created.observation.id,
      ),
      false,
    );

    const draftAnswerResponse = await saveAnswerRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/answers/${fixture.requiredIndicatorId}`,
        "PUT",
        { type: "SCALE", score: 3, note: "Unauthorized staff edit" },
      ) as Parameters<typeof saveAnswerRoute>[0],
      {
        params: Promise.resolve({
          id: created.observation.id,
          indicatorId: fixture.requiredIndicatorId,
        }),
      },
    );
    assert.equal(draftAnswerResponse.status, 403);
    const draftAnswerBody = await responseBody<{ error: string }>(draftAnswerResponse);
    assert.equal(draftAnswerBody.error.includes(fixture.prefix), false);

    setObservationTestActor(fixture.managerA);
    const managerDraftResponse = await getObservationRoute(
      new NextRequest(`http://localhost/api/observations/${created.observation.id}`),
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(managerDraftResponse.status, 200);
    const invalidIndicatorResponse = await saveAnswerRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/answers/${fixture.optionalIndicatorId}`,
        "PUT",
        { type: "TEXT", textValue: "" },
      ) as Parameters<typeof saveAnswerRoute>[0],
      {
        params: Promise.resolve({
          id: created.observation.id,
          indicatorId: fixture.optionalIndicatorId,
        }),
      },
    );
    assert.equal(invalidIndicatorResponse.status, 422);

    const savedResponse = await saveAnswerRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/answers/${fixture.requiredIndicatorId}`,
        "PUT",
        { type: "SCALE", score: 4, note: "Meets expectations" },
      ) as Parameters<typeof saveAnswerRoute>[0],
      {
        params: Promise.resolve({
          id: created.observation.id,
          indicatorId: fixture.requiredIndicatorId,
        }),
      },
    );
    assert.equal(savedResponse.status, 200);
    const saved = await responseBody<Record<string, unknown>>(savedResponse);
    assert.equal("indicator_id" in (saved.answer as Record<string, unknown>), false);
    assert.equal((saved.answer as Record<string, unknown>).indicatorId, fixture.requiredIndicatorId);

    const submittedResponse = await submitObservationRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/submit`,
        "PATCH",
      ) as Parameters<typeof submitObservationRoute>[0],
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(submittedResponse.status, 200);
    const submitted = await responseBody<Record<string, unknown>>(submittedResponse);
    assert.equal(submitted.status, "submitted");
    assert.equal("submitted_at" in submitted, false);

    setObservationTestActor(fixture.staffA);
    const staffReportResponse = await getObservationRoute(
      new NextRequest(`http://localhost/api/observations/${created.observation.id}`),
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(staffReportResponse.status, 200);
    const staffReport = await responseBody<{
      observation: { answers?: unknown[]; activity: unknown[] };
      permissions: { canEdit: boolean; canAcknowledge: boolean };
    }>(staffReportResponse);
    assert.equal(staffReport.observation.answers?.length, 1);
    assert.ok(staffReport.observation.activity.length > 0);
    assert.equal(staffReport.permissions.canEdit, false);
    assert.equal(staffReport.permissions.canAcknowledge, true);

    const submittedListResponse = await listObservationsRoute(
      new Request(
        `http://localhost/api/observations?q=${encodeURIComponent(fixture.prefix)}&page=1&pageSize=10`,
      ),
    );
    const submittedList = await responseBody<{
      data: Array<{ id: string; nextAction: string }>;
      pagination: { total: number; totalPages: number };
    }>(submittedListResponse);
    assert.equal(submittedList.pagination.total, 1);
    assert.equal(submittedList.pagination.totalPages, 1);
    assert.deepEqual(submittedList.data.map((item) => item.id), [created.observation.id]);
    assert.equal(submittedList.data[0]?.nextAction, "acknowledge");

    const submittedAnswerResponse = await saveAnswerRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/answers/${fixture.requiredIndicatorId}`,
        "PUT",
        { type: "SCALE", score: 2, note: "Submitted records are read-only" },
      ) as Parameters<typeof saveAnswerRoute>[0],
      {
        params: Promise.resolve({
          id: created.observation.id,
          indicatorId: fixture.requiredIndicatorId,
        }),
      },
    );
    assert.equal(submittedAnswerResponse.status, 409);

    const acknowledgedResponse = await acknowledgeObservationRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/acknowledge`,
        "PATCH",
        { response: "I have reviewed and understood this observation." },
      ) as Parameters<typeof acknowledgeObservationRoute>[0],
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(acknowledgedResponse.status, 200);
    assert.equal((await responseBody<{ status: string }>(acknowledgedResponse)).status, "acknowledged");

    setObservationTestActor(fixture.admin);
    const reassignedResponse = await updateObservationRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}`,
        "PATCH",
        { managerId: fixture.managerB.id },
      ) as Parameters<typeof updateObservationRoute>[0],
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(reassignedResponse.status, 200);
    const reassigned = await queryOne<{ managerId: string }>(
      `SELECT "managerId" FROM observations WHERE id = $1`,
      [created.observation.id],
    );
    assert.equal(reassigned?.managerId, fixture.managerB.id);

    const reopenedResponse = await reopenObservationRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/reopen`,
        "PATCH",
        { reason: "Correct the final report before publication." },
      ) as Parameters<typeof reopenObservationRoute>[0],
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(reopenedResponse.status, 200);
    assert.equal((await responseBody<{ status: string }>(reopenedResponse)).status, "draft");

    setObservationTestActor(fixture.staffA);
    const reopenedPrivateResponse = await getObservationRoute(
      new NextRequest(`http://localhost/api/observations/${created.observation.id}`),
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(reopenedPrivateResponse.status, 403);

    const reopenedListResponse = await listObservationsRoute(
      new Request(
        `http://localhost/api/observations?q=${encodeURIComponent(fixture.prefix)}&page=1&pageSize=10`,
      ),
    );
    const reopenedList = await responseBody<{
      data: Array<{ id: string }>;
      pagination: { total: number; totalPages: number };
    }>(reopenedListResponse);
    assert.deepEqual(reopenedList.data, []);
    assert.deepEqual(reopenedList.pagination, { page: 1, pageSize: 10, total: 0, totalPages: 0 });

    const reopenedSummaryResponse = await observationSummaryRoute();
    const reopenedSummary = await responseBody<{
      counts: ObservationSummaryCounts;
      needsAttention: Array<{ id: string }>;
      recent: Array<{ id: string }>;
    }>(reopenedSummaryResponse);
    assert.deepEqual(reopenedSummary.counts, baselineStaffSummary.counts);
    assert.equal(
      [...reopenedSummary.needsAttention, ...reopenedSummary.recent].some(
        (item) => item.id === created.observation.id,
      ),
      false,
    );

    const reopenedAnswerResponse = await saveAnswerRoute(
      jsonRequest(
        `http://localhost/api/observations/${created.observation.id}/answers/${fixture.requiredIndicatorId}`,
        "PUT",
        { type: "SCALE", score: 4, note: "Reopened record remains private" },
      ) as Parameters<typeof saveAnswerRoute>[0],
      {
        params: Promise.resolve({
          id: created.observation.id,
          indicatorId: fixture.requiredIndicatorId,
        }),
      },
    );
    assert.equal(reopenedAnswerResponse.status, 403);

    setObservationTestActor({
      id: fixture.staffA.id,
      roles: ["staff", "director"],
    });
    const independentlyPrivilegedResponse = await getObservationRoute(
      new NextRequest(`http://localhost/api/observations/${created.observation.id}`),
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(independentlyPrivilegedResponse.status, 200);
    const independentlyPrivileged = await responseBody<{
      observation: { answers?: unknown[] };
      permissions: { canEdit: boolean; canViewResponses: boolean };
    }>(independentlyPrivilegedResponse);
    assert.equal("answers" in independentlyPrivileged.observation, false);
    assert.equal(independentlyPrivileged.permissions.canViewResponses, false);
    assert.equal(independentlyPrivileged.permissions.canEdit, false);

    setObservationTestActor(fixture.admin);
    const adminDraftResponse = await getObservationRoute(
      new NextRequest(`http://localhost/api/observations/${created.observation.id}`),
      { params: Promise.resolve({ id: created.observation.id }) },
    );
    assert.equal(adminDraftResponse.status, 200);
    const adminDraft = await responseBody<{
      observation: { answers?: unknown[] };
      permissions: { canEdit: boolean; canViewResponses: boolean };
    }>(adminDraftResponse);
    assert.equal(adminDraft.observation.answers?.length, 1);
    assert.equal(adminDraft.permissions.canViewResponses, true);
    assert.equal(adminDraft.permissions.canEdit, true);
  } finally {
    setObservationTestActor(null);
    if (fixture) await cleanupWorkflowFixture(fixture);
  }
});

test("notification settings update records actor and before/after audit snapshots", async () => {
  let fixture: Fixture | null = null;
  let before: ObservationNotificationSettings | null = null;
  try {
    fixture = await insertFixture();
    before = await getObservationNotificationSettings();
    const input = {
      notificationsEnabled: before.notificationsEnabled,
      submissionEmailsEnabled: !before.submissionEmailsEnabled,
      reminderEmailsEnabled: before.reminderEmailsEnabled,
      firstReminderDays: before.firstReminderDays,
      reminderIntervalDays: before.reminderIntervalDays,
      automaticAcknowledgementEnabled: before.automaticAcknowledgementEnabled,
      automaticAcknowledgementDays: before.automaticAcknowledgementDays,
      personalAcknowledgementEmailsEnabled: before.personalAcknowledgementEmailsEnabled,
      automaticAcknowledgementEmailsEnabled: before.automaticAcknowledgementEmailsEnabled,
      reopenEmailsEnabled: before.reopenEmailsEnabled,
      reassignmentEmailsEnabled: before.reassignmentEmailsEnabled,
      schedulerEnabled: before.schedulerEnabled,
      schedulerIntervalMinutes: before.schedulerIntervalMinutes,
    };

    const updated = await updateObservationNotificationSettings(input, fixture.admin.id);
    assert.equal(updated.updatedBy?.id, fixture.admin.id);
    assert.equal(updated.submissionEmailsEnabled, input.submissionEmailsEnabled);

    const audit = await queryOne<{
      actorId: string;
      beforeSettings: Record<string, unknown>;
      afterSettings: Record<string, unknown>;
    }>(
      `SELECT actor_id::text AS "actorId",
              before_settings AS "beforeSettings",
              after_settings AS "afterSettings"
         FROM observation_notification_setting_updates
        WHERE actor_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [fixture.admin.id],
    );
    assert.equal(audit?.actorId, fixture.admin.id);
    assert.equal(audit?.beforeSettings.submissionEmailsEnabled, before.submissionEmailsEnabled);
    assert.equal(audit?.afterSettings.submissionEmailsEnabled, input.submissionEmailsEnabled);
    assert.equal(
      await queryOne<{ updatedById: string }>(
        `SELECT updated_by_id::text AS "updatedById"
           FROM observation_notification_settings
          WHERE id = 1`,
      ).then((row) => row?.updatedById),
      fixture.admin.id,
    );
  } finally {
    if (fixture && before) {
      await updateObservationNotificationSettings(
        {
          notificationsEnabled: before.notificationsEnabled,
          submissionEmailsEnabled: before.submissionEmailsEnabled,
          reminderEmailsEnabled: before.reminderEmailsEnabled,
          firstReminderDays: before.firstReminderDays,
          reminderIntervalDays: before.reminderIntervalDays,
          automaticAcknowledgementEnabled: before.automaticAcknowledgementEnabled,
          automaticAcknowledgementDays: before.automaticAcknowledgementDays,
          personalAcknowledgementEmailsEnabled: before.personalAcknowledgementEmailsEnabled,
          automaticAcknowledgementEmailsEnabled: before.automaticAcknowledgementEmailsEnabled,
          reopenEmailsEnabled: before.reopenEmailsEnabled,
          reassignmentEmailsEnabled: before.reassignmentEmailsEnabled,
          schedulerEnabled: before.schedulerEnabled,
          schedulerIntervalMinutes: before.schedulerIntervalMinutes,
        },
        fixture.admin.id,
      );
    }
    if (fixture) {
      await query(`DELETE FROM observation_notification_setting_updates WHERE actor_id = $1`, [
        fixture.admin.id,
      ]);
      await query(
        `UPDATE observation_notification_settings
            SET updated_by_id = NULL
          WHERE updated_by_id = $1`,
        [fixture.admin.id],
      );
      await cleanupFixture(fixture);
    }
  }
});

test("observation scheduler skips processing when global scheduling is disabled", async () => {
  let processorCalled = false;

  for (const settings of [
    { ...AUTOMATION_SETTINGS, notificationsEnabled: false },
    { ...AUTOMATION_SETTINGS, schedulerEnabled: false },
  ]) {
    const result = await runObservationAcknowledgementSchedulerOnce({
      readSettings: async () => settings,
      processAutomation: async () => {
        processorCalled = true;
        throw new Error("processor should not run while scheduling is disabled");
      },
    });
    assert.equal(result, "skipped");
  }

  assert.equal(processorCalled, false);
});

test("observation scheduler skips processing when another replica holds the advisory lock", async () => {
  const lockClient = await pool.connect();
  let processorCalled = false;
  try {
    const lock = await lockClient.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1, $2) AS acquired`,
      [
        OBSERVATION_SCHEDULER_ADVISORY_LOCK.namespace,
        OBSERVATION_SCHEDULER_ADVISORY_LOCK.key,
      ],
    );
    assert.equal(lock.rows[0]?.acquired, true);

    const result = await runObservationAcknowledgementSchedulerOnce({
      readSettings: async () => AUTOMATION_SETTINGS,
      processAutomation: async () => {
        processorCalled = true;
        return {
          checked: 0,
          remindersSent: 0,
          remindersSkipped: 0,
          automaticallyAcknowledged: 0,
          automaticAcknowledgementsSkipped: 0,
          errors: 0,
        };
      },
    });
    assert.equal(result, "skipped");
    assert.equal(processorCalled, false);
  } finally {
    await lockClient.query(`SELECT pg_advisory_unlock($1, $2)`, [
      OBSERVATION_SCHEDULER_ADVISORY_LOCK.namespace,
      OBSERVATION_SCHEDULER_ADVISORY_LOCK.key,
    ]);
    lockClient.release();
  }
});

test("scheduler status records cycle metadata, counts, and the last error", async () => {
  await query(
    `UPDATE observation_acknowledgement_scheduler_status
        SET last_attempted_at = NULL,
            last_successful_at = NULL,
            settings_revision = NULL,
            next_expected_at = NULL,
            advisory_lock_skips = 0,
            checked = 0,
            reminded = 0,
            auto_acknowledged = 0,
            skipped = 0,
            failed = 0,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = 1`,
  );

  const completed = await runObservationAcknowledgementSchedulerOnce({
    readSettings: async () => AUTOMATION_SETTINGS,
    processAutomation: async () => ({
      checked: 7,
      remindersSent: 2,
      remindersSkipped: 1,
      automaticallyAcknowledged: 1,
      automaticAcknowledgementsSkipped: 2,
      errors: 0,
    }),
  });
  assert.equal(completed, "completed");

  const successfulStatus = await queryOne<{
    lastAttemptedAt: Date | null;
    lastSuccessfulAt: Date | null;
    settingsRevision: Date | null;
    nextExpectedAt: Date | null;
    checked: number;
    reminded: number;
    autoAcknowledged: number;
    skipped: number;
    failed: number;
    lastError: string | null;
  }>(
    `SELECT last_attempted_at AS "lastAttemptedAt",
            last_successful_at AS "lastSuccessfulAt",
            settings_revision AS "settingsRevision",
            next_expected_at AS "nextExpectedAt",
            checked,
            reminded,
            auto_acknowledged AS "autoAcknowledged",
            skipped,
            failed,
            last_error AS "lastError"
       FROM observation_acknowledgement_scheduler_status
      WHERE id = 1`,
  );
  assert.ok(successfulStatus?.lastAttemptedAt);
  assert.ok(successfulStatus?.lastSuccessfulAt);
  assert.ok(successfulStatus?.settingsRevision);
  assert.ok(successfulStatus?.nextExpectedAt);
  assert.equal(successfulStatus?.checked, 7);
  assert.equal(successfulStatus?.reminded, 2);
  assert.equal(successfulStatus?.autoAcknowledged, 1);
  assert.equal(successfulStatus?.skipped, 3);
  assert.equal(successfulStatus?.failed, 0);
  assert.equal(successfulStatus?.lastError, null);

  const failed = await runObservationAcknowledgementSchedulerOnce({
    readSettings: async () => AUTOMATION_SETTINGS,
    processAutomation: async () => {
      throw new Error("scheduler status test failure");
    },
  });
  assert.equal(failed, "failed");
  const failedStatus = await queryOne<{
    lastSuccessfulAt: Date | null;
    checked: number;
    skipped: number;
    failed: number;
    lastError: string | null;
  }>(
    `SELECT last_successful_at AS "lastSuccessfulAt",
            checked,
            skipped,
            failed,
            last_error AS "lastError"
       FROM observation_acknowledgement_scheduler_status
      WHERE id = 1`,
  );
  assert.equal(
    failedStatus?.lastSuccessfulAt?.toISOString(),
    successfulStatus?.lastSuccessfulAt?.toISOString(),
  );
  assert.equal(failedStatus?.checked, 0);
  assert.equal(failedStatus?.skipped, 0);
  assert.equal(failedStatus?.failed, 1);
  assert.match(failedStatus?.lastError ?? "", /scheduler status test failure/);

  const secondFailure = await runObservationAcknowledgementSchedulerOnce({
    readSettings: async () => AUTOMATION_SETTINGS,
    processAutomation: async () => {
      throw new Error("second scheduler status test failure");
    },
  });
  assert.equal(secondFailure, "failed");
  assert.equal(
    await queryOne<{ failed: number }>(
      `SELECT failed FROM observation_acknowledgement_scheduler_status WHERE id = 1`,
    ).then((row) => row?.failed),
    1,
  );

  for (const settings of [
    { ...AUTOMATION_SETTINGS, notificationsEnabled: false },
    { ...AUTOMATION_SETTINGS, schedulerEnabled: false },
  ]) {
    await runObservationAcknowledgementSchedulerOnce({ readSettings: async () => settings });
  }
  const skippedStatus = await queryOne<{
    checked: number;
    skipped: number;
    failed: number;
    lastError: string | null;
  }>(
    `SELECT checked, skipped, failed, last_error AS "lastError"
       FROM observation_acknowledgement_scheduler_status
      WHERE id = 1`,
  );
  assert.equal(skippedStatus?.checked, 0);
  assert.equal(skippedStatus?.skipped, 1);
  assert.equal(skippedStatus?.failed, 0);
  assert.equal(skippedStatus?.lastError, null);
});

test("acknowledgement automation is idempotent, retryable, and guarded by submission state", async () => {
  let fixture: Fixture | null = null;
  try {
    fixture = await insertFixture();
    const now = new Date("2026-08-10T12:00:00.000Z");
    const reminderStartedAt = new Date("2026-08-06T12:00:00.000Z");

    const reminderId = await insertAutomationObservation(fixture, {
      submittedAt: reminderStartedAt,
    });
    let reminderDeliveries = 0;
    const sendReminder = async () => {
      reminderDeliveries += 1;
      return { success: true };
    };
    const firstRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [reminderId],
      sendReminder,
    });
    const duplicateRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [reminderId],
      sendReminder,
    });
    assert.equal(firstRun.remindersSent, 1);
    assert.equal(duplicateRun.remindersSkipped, 1);
    assert.equal(reminderDeliveries, 1);
    assert.equal(
      await queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM observation_acknowledgement_reminders
         WHERE observation_id = $1 AND status = 'sent'`,
        [reminderId],
      ).then((row) => row?.count),
      1,
    );

    const retryId = await insertAutomationObservation(fixture, {
      submittedAt: reminderStartedAt,
    });
    let retryAttempts = 0;
    const retryNotifier = async () => {
      retryAttempts += 1;
      return retryAttempts === 1
        ? { success: false, error: "temporary SMTP failure" }
        : { success: true };
    };
    const failedRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [retryId],
      sendReminder: retryNotifier,
    });
    const retryRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [retryId],
      sendReminder: retryNotifier,
    });
    assert.equal(failedRun.errors, 1);
    assert.equal(retryRun.remindersSent, 1);
    assert.equal(retryAttempts, 2);
    assert.equal(
      await queryOne<{ status: string; error: string | null }>(
        `SELECT status, error
         FROM observation_acknowledgement_reminders
         WHERE observation_id = $1`,
        [retryId],
      ).then((row) => row?.status),
      "sent",
    );

    const resubmittedId = await insertAutomationObservation(fixture, {
      submittedAt: reminderStartedAt,
    });
    let staleDeliveryAttempted = false;
    const resubmittedRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [resubmittedId],
      afterReminderClaim: async (observationId) => {
        await query(
          `UPDATE observations
           SET submitted_at = $2, acknowledgement_automation_started_at = $2
           WHERE id = $1`,
          [observationId, now],
        );
      },
      sendReminder: async () => {
        staleDeliveryAttempted = true;
        return { success: true };
      },
    });
    assert.equal(resubmittedRun.remindersSkipped, 1);
    assert.equal(staleDeliveryAttempted, false);
    assert.equal(
      await queryOne<{ status: string }>(
        `SELECT status
         FROM observation_acknowledgement_reminders
         WHERE observation_id = $1`,
        [resubmittedId],
      ).then((row) => row?.status),
      "skipped",
    );

    const acknowledgedId = await insertAutomationObservation(fixture, {
      submittedAt: reminderStartedAt,
    });
    let postAcknowledgementDelivery = false;
    const acknowledgedRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [acknowledgedId],
      afterReminderClaim: async (observationId) => {
        await query(
          `UPDATE observations
           SET status = 'acknowledged', acknowledged_at = $2,
               acknowledgement_method = 'personal'
           WHERE id = $1`,
          [observationId, now],
        );
      },
      sendReminder: async () => {
        postAcknowledgementDelivery = true;
        return { success: true };
      },
    });
    assert.equal(acknowledgedRun.remindersSkipped, 1);
    assert.equal(postAcknowledgementDelivery, false);

    const remindersDisabledId = await insertAutomationObservation(fixture, {
      submittedAt: reminderStartedAt,
    });
    const remindersDisabledRun =
      await processObservationAcknowledgementAutomationRuntime(now, {
        settings: { ...AUTOMATION_SETTINGS, reminderEmailsEnabled: false },
        observationIds: [remindersDisabledId],
        sendReminder: async () => {
          throw new Error("disabled reminders must not be delivered");
        },
      });
    assert.equal(remindersDisabledRun.checked, 1);
    assert.equal(remindersDisabledRun.remindersSent, 0);
    assert.equal(
      await queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM observation_acknowledgement_reminders
         WHERE observation_id = $1`,
        [remindersDisabledId],
      ).then((row) => row?.count),
      0,
    );
  } finally {
    if (fixture) await cleanupFixture(fixture);
  }
});

test("acknowledgement automation auto-acknowledges once and ignores legacy per-user observation preferences", async () => {
  let fixture: Fixture | null = null;
  try {
    fixture = await insertFixture();
    const now = new Date("2026-09-15T12:00:00.000Z");
    const overdueSubmission = new Date("2026-08-15T12:00:00.000Z");
    const automaticId = await insertAutomationObservation(fixture, {
      submittedAt: overdueSubmission,
    });
    let automaticNotifications = 0;
    const automaticNotifier = async () => {
      automaticNotifications += 1;
      return { success: true };
    };
    const firstRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [automaticId],
      sendAutomaticAcknowledgement: automaticNotifier,
    });
    const secondRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [automaticId],
      sendAutomaticAcknowledgement: automaticNotifier,
    });
    assert.equal(firstRun.automaticallyAcknowledged, 1);
    assert.equal(secondRun.checked, 0);
    assert.equal(automaticNotifications, 2);
    const automaticObservation = await queryOne<{
      status: string;
      method: string | null;
      acknowledgedAt: Date | null;
    }>(
      `SELECT status, acknowledgement_method AS method,
              acknowledged_at AS "acknowledgedAt"
       FROM observations WHERE id = $1`,
      [automaticId],
    );
    assert.equal(automaticObservation?.status, "acknowledged");
    assert.equal(automaticObservation?.method, "automatic");
    assert.ok(automaticObservation?.acknowledgedAt);
    assert.equal(
      await queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM observation_updates
         WHERE observation_id = $1 AND event_type = 'automatic_acknowledged'`,
        [automaticId],
      ).then((row) => row?.count),
      1,
    );

    const ineligibleAutomaticId = await insertAutomationObservation(fixture, {
      submittedAt: overdueSubmission,
    });
    let ineligibleNotificationAttempted = false;
    const ineligibleRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [ineligibleAutomaticId],
      beforeAutomaticAcknowledgement: async (observationId) => {
        await query(
          `UPDATE observations
           SET status = 'draft', acknowledgement_automation_started_at = NULL
           WHERE id = $1`,
          [observationId],
        );
      },
      sendAutomaticAcknowledgement: async () => {
        ineligibleNotificationAttempted = true;
        return { success: true };
      },
    });
    assert.equal(ineligibleRun.automaticAcknowledgementsSkipped, 1);
    assert.equal(ineligibleNotificationAttempted, false);
    assert.equal(
      await queryOne<{ status: string }>(
        `SELECT status FROM observations WHERE id = $1`,
        [ineligibleAutomaticId],
      ).then((row) => row?.status),
      "draft",
    );

    const automaticDisabledId = await insertAutomationObservation(fixture, {
      submittedAt: overdueSubmission,
    });
    const automaticDisabledRun =
      await processObservationAcknowledgementAutomationRuntime(now, {
        settings: {
          ...AUTOMATION_SETTINGS,
          reminderEmailsEnabled: false,
          automaticAcknowledgementEnabled: false,
        },
        observationIds: [automaticDisabledId],
        sendAutomaticAcknowledgement: async () => {
          throw new Error("disabled automatic acknowledgement must not notify");
        },
      });
    assert.equal(automaticDisabledRun.checked, 1);
    assert.equal(automaticDisabledRun.automaticallyAcknowledged, 0);
    const automaticDisabledObservation = await queryOne<{
      status: string;
      acknowledgedAt: Date | null;
    }>(
      `SELECT status, acknowledged_at AS "acknowledgedAt"
       FROM observations WHERE id = $1`,
      [automaticDisabledId],
    );
    assert.equal(automaticDisabledObservation?.status, "submitted");
    assert.equal(automaticDisabledObservation?.acknowledgedAt, null);

    const preferenceId = await insertAutomationObservation(fixture, {
      submittedAt: new Date("2026-09-11T12:00:00.000Z"),
    });
    await query(
      `INSERT INTO notification_preferences (user_id, email_enabled, observation_updates)
       VALUES ($1, false, false)
       ON CONFLICT (user_id) DO UPDATE
         SET email_enabled = false, observation_updates = false`,
      [fixture.staffA.id],
    );
    let preferenceDeliveries = 0;
    const preferenceRun = await processObservationAcknowledgementAutomation(now, {
      observationIds: [preferenceId],
      sendReminder: async () => {
        preferenceDeliveries += 1;
        return { success: true };
      },
    });
    assert.equal(preferenceRun.remindersSent, 1);
    assert.equal(preferenceDeliveries, 1);
    assert.equal(
      await queryOne<{ status: string }>(
        `SELECT status FROM observation_acknowledgement_reminders
         WHERE observation_id = $1`,
        [preferenceId],
      ).then((row) => row?.status),
      "sent",
    );
  } finally {
    if (fixture) await cleanupFixture(fixture);
  }
});

after(async () => {
  setObservationTestActor(null);
  await pool.end();
});

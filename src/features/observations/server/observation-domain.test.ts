import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionObservation, normalizeObservationStatus } from "./lifecycle";
import { getObservationPermissions } from "./permissions";
import { dateOnlyToIso, normalizeDateOnly } from "./dates";
import { buildListFilters } from "./queries";
import {
  calculateObservationProgress,
  findIncompleteRequiredIndicators,
  isObservationAnswerComplete,
} from "./validation";
import type { ObservationIndicatorForProgress } from "../types";
import { formatObservationDate, utcDateValue } from "../utils";
import {
  getObservationReminderPeriod,
  isAutomaticAcknowledgementDue,
} from "./acknowledgementAutomationConfig";
import { getObservationSchedulerConfig } from "./observationAcknowledgementScheduler";
import { DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS } from "./notificationSettings";
import {
  observationReopenSchema,
  parseObservationListQuery,
} from "../schemas";
import {
  getObservationAgeStart,
  getObservationPrimaryAction,
  getObservationStageActivity,
  getObservationStageTimestamp,
  shouldShowObservationResponses,
  sortObservationActivity,
} from "../detailPresentation";
import type {
  ObservationActivityEntry,
  ObservationPermissions,
} from "../types";
import {
  acknowledgeObservation,
  reopenObservation,
  saveObservationAnswer,
} from "../api/queries";

const draft = { status: "draft" as const, staffId: "staff", managerId: "manager" };

test("date-only values normalize, serialize, and display without timezone shifts", () => {
  assert.equal(normalizeDateOnly("2026-09-05", "Due date"), "2026-09-05");
  assert.equal(
    normalizeDateOnly("2026-09-05T23:59:59.000Z", "Due date"),
    "2026-09-05",
  );
  assert.equal(dateOnlyToIso("2026-09-05"), "2026-09-05T00:00:00.000Z");
  assert.equal(dateOnlyToIso(null), null);
  assert.equal(formatObservationDate("2026-09-05T00:00:00.000Z"), "5 Sep 2026");
  assert.equal(
    utcDateValue(new Date("2026-09-05T23:59:59.000Z")),
    "2026-09-05",
  );
  assert.throws(() => normalizeDateOnly("2026-02-30", "Due date"));
});

test("scheduler configuration uses global settings and a fixed startup delay", () => {
  assert.deepEqual(
    getObservationSchedulerConfig(DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS),
    {
      enabled: true,
      intervalMs: 60 * 60 * 1000,
      initialDelayMs: 30 * 1000,
    },
  );
  assert.deepEqual(
    getObservationSchedulerConfig({
      notificationsEnabled: true,
      schedulerEnabled: false,
      schedulerIntervalMinutes: 15,
    }),
    {
      enabled: false,
      intervalMs: 15 * 60 * 1000,
      initialDelayMs: 30 * 1000,
    },
  );
  assert.equal(
    getObservationSchedulerConfig({
      notificationsEnabled: false,
      schedulerEnabled: true,
      schedulerIntervalMinutes: 15,
    }).enabled,
    false,
  );
});

test("acknowledgement automation uses explicit configured timing", () => {
  const submitted = new Date("2026-08-01T00:00:00.000Z");
  const timing = {
    firstReminderDays: 3,
    reminderIntervalDays: 2,
    automaticAcknowledgementDays: 30,
  };
  assert.equal(
    getObservationReminderPeriod(
      submitted,
      new Date("2026-08-03T23:59:59.999Z"),
      timing,
    ),
    null,
  );
  assert.equal(
    getObservationReminderPeriod(
      submitted,
      new Date("2026-08-04T00:00:00.000Z"),
      timing,
    ),
    0,
  );
  assert.equal(
    getObservationReminderPeriod(
      submitted,
      new Date("2026-08-06T00:00:00.000Z"),
      timing,
    ),
    1,
  );
  assert.equal(
    isAutomaticAcknowledgementDue(
      submitted,
      new Date("2026-08-30T23:59:59.999Z"),
      timing,
    ),
    false,
  );
  assert.equal(
    isAutomaticAcknowledgementDue(
      submitted,
      new Date("2026-08-31T00:00:00.000Z"),
      timing,
    ),
    true,
  );
});

test("draft responses are hidden from staff and directors", () => {
  assert.equal(
    getObservationPermissions({ id: "staff", roles: ["staff"] }, draft)
      .canViewResponses,
    false,
  );
  assert.equal(
    getObservationPermissions({ id: "director", roles: ["director"] }, draft)
      .canViewResponses,
    false,
  );
});

test("participant-aware permissions hide drafts and allow only pending acknowledgements", () => {
  const participantDraft = {
    status: "draft" as const,
    managerId: "manager",
    isParticipant: true,
    participantAcknowledgedAt: null,
  };
  const participantSubmitted = {
    ...participantDraft,
    status: "submitted" as const,
  };

  assert.equal(
    getObservationPermissions(
      { id: "participant-b", roles: ["staff"] },
      participantDraft,
    ).canViewRecord,
    false,
  );
  assert.equal(
    getObservationPermissions(
      { id: "participant-b", roles: ["staff"] },
      participantSubmitted,
    ).canAcknowledge,
    true,
  );
  assert.equal(
    getObservationPermissions(
      { id: "participant-b", roles: ["staff"] },
      {
        ...participantSubmitted,
        participantAcknowledgedAt: "2026-08-20T00:00:00.000Z",
      },
    ).canAcknowledge,
    false,
  );
  assert.equal(
    getObservationPermissions(
      { id: "unrelated", roles: ["staff"] },
      { ...participantSubmitted, isParticipant: false },
    ).canViewRecord,
    false,
  );
});

test("admin and assigned manager can view and edit draft responses", () => {
  for (const actor of [
    { id: "admin", roles: ["admin"] },
    { id: "manager", roles: ["manager"] },
  ]) {
    const permissions = getObservationPermissions(actor, draft);
    assert.equal(permissions.canViewResponses, true);
    assert.equal(permissions.canEdit, true);
    assert.equal(permissions.canSubmit, true);
    assert.equal(permissions.canDelete, true);
  }
});

test("a manager who is the subject cannot view a draft through subject status alone", () => {
  const permissions = getObservationPermissions(
    { id: "staff", roles: ["manager", "staff"] },
    draft,
  );
  assert.equal(permissions.canViewRecord, false);
  assert.equal(permissions.canViewResponses, false);
  assert.equal(permissions.canEdit, false);
});

test("a subject with an independent privileged role retains draft access", () => {
  for (const actor of [
    { id: "staff", roles: ["staff", "director"] },
    { id: "staff", roles: ["staff", "admin"] },
  ]) {
    assert.equal(getObservationPermissions(actor, draft).canViewRecord, true);
  }
});

test("detail permissions cover the role and lifecycle action matrix", () => {
  const records = {
    draft: { status: "draft" as const, staffId: "staff", managerId: "manager" },
    submitted: {
      status: "submitted" as const,
      staffId: "staff",
      managerId: "manager",
    },
    acknowledged: {
      status: "acknowledged" as const,
      staffId: "staff",
      managerId: "manager",
    },
  };

  const managerDraft = getObservationPermissions(
    { id: "manager", roles: ["manager"] },
    records.draft,
  );
  assert.equal(managerDraft.canSubmit, true);
  assert.equal(managerDraft.canViewResponses, true);

  const staffDraft = getObservationPermissions(
    { id: "staff", roles: ["staff"] },
    records.draft,
  );
  assert.equal(staffDraft.canViewRecord, false);
  assert.equal(staffDraft.canViewResponses, false);
  assert.equal(staffDraft.canAcknowledge, false);
  assert.equal(staffDraft.canDelete, false);

  const staffSubmitted = getObservationPermissions(
    { id: "staff", roles: ["staff"] },
    records.submitted,
  );
  assert.equal(staffSubmitted.canViewRecord, true);
  assert.equal(staffSubmitted.canViewResponses, true);
  assert.equal(staffSubmitted.canAcknowledge, true);

  const staffAcknowledged = getObservationPermissions(
    { id: "staff", roles: ["staff"] },
    records.acknowledged,
  );
  assert.equal(staffAcknowledged.canViewRecord, true);
  assert.equal(staffAcknowledged.canViewResponses, true);
  assert.equal(staffAcknowledged.canAcknowledge, false);

  const directorDraft = getObservationPermissions(
    { id: "director", roles: ["director"] },
    records.draft,
  );
  const directorSubmitted = getObservationPermissions(
    { id: "director", roles: ["director"] },
    records.submitted,
  );
  assert.equal(directorDraft.canViewResponses, false);
  assert.equal(directorSubmitted.canViewResponses, true);

  const adminSubmitted = getObservationPermissions(
    { id: "admin", roles: ["admin"] },
    records.submitted,
  );
  const adminCompleted = getObservationPermissions(
    { id: "admin", roles: ["admin"] },
    records.acknowledged,
  );
  assert.equal(adminSubmitted.canReopen, true);
  assert.equal(adminSubmitted.canDelete, true);
  assert.equal(adminCompleted.canReopen, true);
  assert.equal(adminCompleted.canDelete, false);
  assert.equal(adminCompleted.canAcknowledge, false);
});

test("only canonical lifecycle transitions are allowed", () => {
  assert.equal(canTransitionObservation("draft", "submitted"), true);
  assert.equal(canTransitionObservation("submitted", "acknowledged"), true);
  assert.equal(canTransitionObservation("submitted", "draft"), true);
  assert.equal(canTransitionObservation("acknowledged", "draft"), true);
  assert.equal(canTransitionObservation("draft", "acknowledged"), false);
  assert.equal(normalizeObservationStatus("pending"), "draft");
  assert.equal(normalizeObservationStatus("reviewed"), "submitted");
  assert.equal(
    normalizeObservationStatus("reviewed", "2026-07-18T00:00:00Z"),
    "acknowledged",
  );
});

test("zero-value placeholder rows are incomplete", () => {
  assert.equal(isObservationAnswerComplete("SCALE", { score: 0 }), false);
  assert.equal(isObservationAnswerComplete("TEXT", { textValue: "  " }), false);
  assert.equal(
    isObservationAnswerComplete(
      "CHOICE",
      { selectedOption: "unknown" },
      ["yes", "no"],
    ),
    false,
  );
});

test("list query accepts participantId and retains the legacy staffId alias", () => {
  assert.equal(
    parseObservationListQuery(
      new URLSearchParams({ participantId: "participant-b" }),
    ).participantId,
    "participant-b",
  );
  assert.equal(
    parseObservationListQuery(new URLSearchParams({ staffId: "legacy-staff" }))
      .staffId,
    "legacy-staff",
  );
});

test("list filters use participant EXISTS predicates without multiplying observations", () => {
  const params: unknown[] = [];
  const { whereSql, actionExpression } = buildListFilters(
    { id: "participant-b", roles: ["staff"] },
    {
      q: "Teacher Two",
      participantId: "participant-b",
      sort: "updated_desc",
      page: 1,
      pageSize: 20,
    },
    params,
  );

  assert.match(whereSql, /EXISTS \(\s*SELECT 1 FROM observation_participants visibility_participant/);
  assert.match(whereSql, /EXISTS \(\s*SELECT 1\s*FROM observation_participants search_participant/);
  assert.match(whereSql, /EXISTS \(\s*SELECT 1 FROM observation_participants filtered_participant/);
  assert.doesNotMatch(whereSql, /JOIN observation_participants/);
  assert.match(actionExpression, /action_participant\.acknowledged_at IS NULL/);
  assert.deepEqual(params, [
    "participant-b",
    "%Teacher Two%",
    "participant-b",
  ]);
});

test("overdue filters include submitted observations only", () => {
  const params: unknown[] = [];
  const { whereSql } = buildListFilters(
    { id: "admin", roles: ["admin"] },
    {
      q: "",
      overdue: "true",
      sort: "updated_desc",
      page: 1,
      pageSize: 20,
    },
    params,
  );

  assert.match(whereSql, /= 'submitted'/);
  assert.match(whereSql, /due_at::date < \(NOW\(\) AT TIME ZONE 'UTC'\)::date/);
  assert.match(whereSql, /COALESCE/);
  assert.doesNotMatch(whereSql, /<> 'acknowledged'/);
});

test("list query parsing falls back for invalid values", () => {
  const parsed = parseObservationListQuery(
    new URLSearchParams({
      status: "invalid",
      page: "0",
      pageSize: "999",
      sort: "unknown",
      overdue: "maybe",
    }),
  );

  assert.equal(parsed.status, undefined);
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 20);
  assert.equal(parsed.sort, "updated_desc");
  assert.equal(parsed.overdue, undefined);
});

test("detail presentation selects the permitted primary action", () => {
  const base: ObservationPermissions = {
    canViewRecord: true,
    canViewResponses: true,
    canEdit: false,
    canSubmit: false,
    canAcknowledge: false,
    canReopen: false,
    canReassign: false,
    canDelete: false,
  };

  assert.equal(getObservationPrimaryAction({ ...base, canEdit: true }), "edit");
  assert.equal(
    getObservationPrimaryAction({ ...base, canAcknowledge: true }),
    "acknowledge",
  );
  assert.equal(getObservationPrimaryAction({ ...base, canReopen: true }), "reopen");
  assert.equal(getObservationPrimaryAction(base), null);
});

test("reopen reason validation trims input and requires useful context", () => {
  assert.equal(observationReopenSchema.safeParse({ reason: "too short" }).success, false);
  assert.deepEqual(
    observationReopenSchema.parse({ reason: "  Needs score correction  " }),
    { reason: "Needs score correction" },
  );
});

test("detail privacy uses only server-derived response permission", () => {
  assert.equal(
    shouldShowObservationResponses({
      canViewRecord: true,
      canViewResponses: false,
      canEdit: false,
      canSubmit: false,
      canAcknowledge: false,
      canReopen: false,
      canReassign: false,
      canDelete: false,
    }),
    false,
  );
});

test("detail lifecycle timestamps reflect reopen and current-stage aging", () => {
  const observation = {
    status: "draft" as const,
    createdAt: "2026-07-01T00:00:00.000Z",
    reopenedAt: "2026-07-10T00:00:00.000Z",
    submittedAt: null,
    acknowledgedAt: null,
  };
  assert.equal(
    getObservationStageTimestamp(observation, "draft"),
    observation.reopenedAt,
  );
  assert.equal(getObservationAgeStart(observation), observation.reopenedAt);
});

test("detail activity is ordered newest first and supports an empty state", () => {
  const activity: ObservationActivityEntry[] = [
    {
      id: "older",
      eventType: "submitted",
      statusFrom: "draft",
      statusTo: "submitted",
      notes: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedBy: null,
    },
    {
      id: "newer",
      eventType: "acknowledged",
      statusFrom: "submitted",
      statusTo: "acknowledged",
      notes: null,
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedBy: null,
    },
  ];
  assert.deepEqual(sortObservationActivity(activity).map((entry) => entry.id), [
    "newer",
    "older",
  ]);
  assert.deepEqual(sortObservationActivity([]), []);
  assert.equal(
    getObservationStageActivity(activity, "acknowledged")?.id,
    "newer",
  );
});

test("acknowledge and reopen clients use stable PATCH endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{
    url: string;
    method: string | undefined;
    body: string | undefined;
  }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return new Response(null, { status: 204 });
  };

  try {
    await acknowledgeObservation("observation-1", {
      response: "I have reviewed this observation.",
    });
    await reopenObservation("observation-1", {
      reason: "Needs score correction",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    {
      url: "/api/observations/observation-1/acknowledge",
      method: "PATCH",
      body: JSON.stringify({
        response: "I have reviewed this observation.",
      }),
    },
    {
      url: "/api/observations/observation-1/reopen",
      method: "PATCH",
      body: JSON.stringify({ reason: "Needs score correction" }),
    },
  ]);
});

test("answer client uses the typed per-indicator PUT endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{
    url: string;
    method: string | undefined;
    body: string | undefined;
  }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return new Response(
      JSON.stringify({
        answer: {
          id: "answer-1",
          indicatorId: "indicator-1",
          observationId: "observation-1",
          score: 82,
          note: "Evidence",
          evidence: null,
          textValue: null,
          selectedOption: null,
          selectedOptions: null,
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:01.000Z",
        },
        savedAt: "2026-07-18T00:00:01.000Z",
        progress: {
          requiredAnswered: 1,
          requiredTotal: 2,
          optionalAnswered: 0,
          optionalTotal: 0,
          percentage: 50,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await saveObservationAnswer(
      "observation-1",
      "indicator-1",
      { type: "SCALE", score: 82, note: "Evidence" },
    );
    assert.equal(result.progress.percentage, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    {
      url: "/api/observations/observation-1/answers/indicator-1",
      method: "PUT",
      body: JSON.stringify({ type: "SCALE", score: 82, note: "Evidence" }),
    },
  ]);
});

test("transition clients surface API errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Not permitted" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      () =>
        reopenObservation("observation-1", {
          reason: "Needs score correction",
        }),
      /Not permitted/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("progress and incomplete required indicators use answer semantics", () => {
  const indicators: ObservationIndicatorForProgress[] = [
    {
      id: "scale",
      name: "Scale",
      sectionId: "section",
      sectionName: "Section",
      questionType: "SCALE",
      isRequired: true,
      answer: { score: 0 },
    },
    {
      id: "text",
      name: "Text",
      sectionId: "section",
      sectionName: "Section",
      questionType: "TEXT",
      isRequired: true,
      answer: { textValue: "complete" },
    },
    {
      id: "choice",
      name: "Choice",
      sectionId: "section",
      sectionName: "Section",
      questionType: "CHOICE",
      isRequired: false,
      scoreOptions: ["yes", "no"],
      answer: { selectedOption: "yes" },
    },
  ];

  assert.deepEqual(calculateObservationProgress(indicators), {
    requiredAnswered: 1,
    requiredTotal: 2,
    optionalAnswered: 1,
    optionalTotal: 1,
    percentage: 50,
  });
  assert.deepEqual(findIncompleteRequiredIndicators(indicators), [
    {
      sectionId: "section",
      sectionName: "Section",
      indicatorId: "scale",
      indicatorName: "Scale",
    },
  ]);
});

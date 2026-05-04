# Strategic Planning Module — Spec

Status: Draft v2
Owner: MAD Labs
Last updated: 2026

---

## 1. Purpose

A first-class place inside ProofPoint where each **department** authors and tracks
its 5-year **Strategic Plan**. Each plan is a living document linking strategic
**Goals → Objectives → Programs** down to the existing **KPI** catalog
(`KpiDomain → KpiStandard → Kpi`), so that appraisal evidence and strategic
planning share the same KPI spine.

Reference source: *MAD Lab Strategic Plan 2026–2030*.

---

## 2. Decisions (resolved with stakeholder)

| # | Decision |
|---|---|
| 1 | **One plan per department.** Kindergarten, Junior High, Elementary, SAFE, CARE, MAD Labs each have exactly one plan. Authorship/editing is department-owned, with director/admin override. |
| 2 | KPIs are codified but the codes are not structured columns today. Migration will add `code` to `KpiDomain`, `KpiStandard`, `Kpi` and **renumber Standards and KPIs to be continuous within their template** (not reset per Standard). |
| 3 | A plan is always a **fixed 5-year** horizon for this iteration. It is a **live document** — content can be updated at any time after publish. Period extension/rolling plans are out of scope. |
| 4 | **Owner = department.** `ownerUserId` records the user who created/authored the plan initially, but authorization is based on `departmentId` plus role. |
| 5 | "Collaborator" means another internal unit/department is involved in that program. Collaborators are visible metadata; they do not grant edit access. |
| 6 | **Program status is set manually** by the department manager/director/admin. Period-target statuses are tracked separately and do not automatically update the program status. |
| 7 | Budget is **IDR per period**, with a free-text description of what the budget pays for. Currency is fixed (IDR) for now. |
| 8 | Evidence files reuse the existing **MinIO** bucket under a `strategic-plans/` prefix. The database stores object keys, not signed URLs. |
| 9 | Visibility: **Draft → only** managers of that department, directors, and admin. **Published → all signed-in users** can read. |
| 10 | No RTF importer. Managers fill the plan **manually** through the UI. |
| 11 | Navigation: **top-level "Strategic Plans"** entry. |
| 12 | The `archived` status is out of scope for this iteration. This version supports `draft` and `published` only. |

---

## 3. Personas & Permissions

Reuses existing `AppRole` enum + `Department` membership.

| Action | Director | Admin | Manager (own dept) | Manager (other dept) | Supervisor / Staff |
|---|---|---|---|---|---|
| Create plan | ✅ any dept | ✅ any dept | ✅ own dept only | ❌ | ❌ |
| Edit plan structure (goals/objectives/programs) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update program progress / status | ✅ | ✅ | ✅ | ❌ | ❌ |
| Publish / unpublish | ✅ | ✅ | ✅ | ❌ | ❌ |
| View **draft** plan | ✅ | ✅ | ✅ | ❌ | ❌ |
| View **published** plan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete plan | ✅ | ✅ | ❌ | ❌ | ❌ |

A user is "manager of dept X" if either condition is true:

1. They have `AppRole.manager` and `Profile.departmentId == X`.
2. They have a manager-equivalent grant for department X via `DepartmentRole`.

Admin/director access bypasses department restrictions. Department manager access
can come from either the user's primary profile department or department-role
membership.

`ownerUserId` records who created the plan. It does **not** control access.
Admin/director may create plans on behalf of any department; in that case,
`ownerUserId` is the admin/director user who created it, while `departmentId`
remains the authoritative owner.

---

## 4. Information Architecture

```text
StrategicPlan  (one per Department)
├─ Period × 5     (auto-seeded: startYear..startYear+4)
└─ Goal *
   └─ Objective *
      └─ Program *
         ├─ ChecklistItem *
         ├─ KpiLink *           → existing Kpi.id
         ├─ PeriodTarget × 5    (one per Period)
         │    targetText, actualText, status, evidenceKey
         ├─ Collaborator *      (other Department refs)
         ├─ BudgetLine *        (period, label, amountIDR, description)
         └─ ProgressUpdate *    (manager note + program status history)
```

Key rules:

- There is **at most one** `StrategicPlan` per `departmentId`.
- The horizon is exactly 5 years in this iteration.
- `endYear` is server-derived as `startYear + 4`.
- Period extension/rolling plans are out of scope.

---

## 5. Data Model — Prisma additions

```prisma
enum StrategicPlanStatus { draft published }
enum ProgramStatus       { not_started on_track at_risk off_track completed }

model StrategicPlan {
  id           String   @id @default(uuid())
  departmentId String   @unique @map("department_id")
  name         String   @db.Text
  description  String?  @db.Text
  vision       String?  @db.Text
  mission      String?  @db.Text
  startYear    Int      @map("start_year")
  endYear      Int      @map("end_year")           // server-derived: startYear + 4
  status       StrategicPlanStatus @default(draft)
  ownerUserId  String?  @map("owner_user_id")      // user who initially created/authored the plan
  publishedAt  DateTime? @map("published_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  department  Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  ownerUser   User?      @relation("PlanOwner", fields: [ownerUserId], references: [id], onDelete: SetNull)
  periods     StrategicPeriod[]
  goals       StrategicGoal[]

  @@index([status])
  @@map("strategic_plans")
}

model StrategicPeriod {
  id        String @id @default(uuid())
  planId    String @map("plan_id")
  label     String @db.Text          // e.g. "2026"
  year      Int                      // canonical year
  sortOrder Int    @map("sort_order")

  plan          StrategicPlan         @relation(fields: [planId], references: [id], onDelete: Cascade)
  periodTargets ProgramPeriodTarget[]
  budgetLines   ProgramBudgetLine[]

  @@unique([planId, year])
  @@unique([planId, sortOrder])
  @@index([planId])
  @@map("strategic_periods")
}

model StrategicGoal {
  id          String  @id @default(uuid())
  planId      String  @map("plan_id")
  number      Int                       // user-visible display number; normally derived from order
  title       String  @db.Text
  description String? @db.Text
  sortOrder   Int     @map("sort_order")

  plan       StrategicPlan        @relation(fields: [planId], references: [id], onDelete: Cascade)
  objectives StrategicObjective[]

  @@unique([planId, number])
  @@unique([planId, sortOrder])
  @@index([planId])
  @@map("strategic_goals")
}

model StrategicObjective {
  id        String @id @default(uuid())
  goalId    String @map("goal_id")
  number    Int                       // user-visible display number; normally derived from order
  title     String @db.Text
  sortOrder Int    @map("sort_order")

  goal     StrategicGoal      @relation(fields: [goalId], references: [id], onDelete: Cascade)
  programs StrategicProgram[]

  @@unique([goalId, number])
  @@unique([goalId, sortOrder])
  @@index([goalId])
  @@map("strategic_objectives")
}

model StrategicProgram {
  id           String  @id @default(uuid())
  objectiveId  String  @map("objective_id")
  code         String  @db.Text          // user-visible, e.g. "P1", "P2"
  title        String  @db.Text
  description  String? @db.Text
  status       ProgramStatus @default(not_started)
  sortOrder    Int     @map("sort_order")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  objective     StrategicObjective    @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  checklist     ProgramChecklistItem[]
  kpiLinks      ProgramKpiLink[]
  targets       ProgramPeriodTarget[]
  collaborators ProgramCollaborator[]
  budgetLines   ProgramBudgetLine[]
  updates       ProgramProgressUpdate[]

  @@unique([objectiveId, code])
  @@unique([objectiveId, sortOrder])
  @@index([objectiveId])
  @@map("strategic_programs")
}

model ProgramChecklistItem {
  id        String  @id @default(uuid())
  programId String  @map("program_id")
  text      String  @db.Text
  done      Boolean @default(false)
  sortOrder Int     @map("sort_order")

  program StrategicProgram @relation(fields: [programId], references: [id], onDelete: Cascade)

  @@unique([programId, sortOrder])
  @@index([programId])
  @@map("program_checklist_items")
}

model ProgramKpiLink {
  id            String  @id @default(uuid())
  programId     String  @map("program_id")
  kpiId         String  @map("kpi_id")
  coverageLabel String? @db.Text     // optional snapshot label, e.g. "D1.S2.K1 Tool Database Coverage"

  program StrategicProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  kpi     Kpi              @relation(fields: [kpiId], references: [id], onDelete: Cascade)

  @@unique([programId, kpiId])
  @@index([programId])
  @@index([kpiId])
  @@map("program_kpi_links")
}

model ProgramPeriodTarget {
  id          String        @id @default(uuid())
  programId   String        @map("program_id")
  periodId    String        @map("period_id")
  targetText  String        @default("") @db.Text
  actualText  String?       @db.Text
  status      ProgramStatus @default(not_started)
  evidenceKey String?       @map("evidence_key") @db.Text   // MinIO object key, not signed URL
  updatedAt   DateTime      @updatedAt @map("updated_at")

  program StrategicProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  period  StrategicPeriod  @relation(fields: [periodId],  references: [id], onDelete: Cascade)

  @@unique([programId, periodId])
  @@index([programId])
  @@index([periodId])
  @@map("program_period_targets")
}

model ProgramCollaborator {
  id           String @id @default(uuid())
  programId    String @map("program_id")
  departmentId String @map("department_id")

  program    StrategicProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  department Department       @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@unique([programId, departmentId])
  @@index([programId])
  @@index([departmentId])
  @@map("program_collaborators")
}

model ProgramBudgetLine {
  id          String   @id @default(uuid())
  programId   String   @map("program_id")
  periodId    String   @map("period_id")
  label       String   @db.Text
  description String?  @db.Text
  amountIdr   Decimal  @default(0) @map("amount_idr") @db.Decimal(15, 2)

  program StrategicProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  period  StrategicPeriod  @relation(fields: [periodId],  references: [id], onDelete: Cascade)

  @@index([programId])
  @@index([periodId])
  @@map("program_budget_lines")
}

model ProgramProgressUpdate {
  id        String        @id @default(uuid())
  programId String        @map("program_id")
  authorId  String        @map("author_id")
  note      String        @db.Text
  status    ProgramStatus
  createdAt DateTime      @default(now()) @map("created_at")

  program StrategicProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  author  User             @relation("ProgressUpdateAuthor", fields: [authorId], references: [id])

  @@index([programId])
  @@index([authorId])
  @@map("program_progress_updates")
}
```

Required relation back-pointers:

- `Department.strategicPlan StrategicPlan?`
- `Department.programCollaborators ProgramCollaborator[]`
- `User.ownedStrategicPlans StrategicPlan[] @relation("PlanOwner")`
- `User.progressUpdates ProgramProgressUpdate[] @relation("ProgressUpdateAuthor")`
- `Kpi.programLinks ProgramKpiLink[]`

### Ordering and numbering rules

- `sortOrder` controls rendering order.
- `StrategicGoal.number` and `StrategicObjective.number` are user-visible display numbers and should normally be derived from sibling order.
- `StrategicProgram.code` is user-visible and unique within the objective for this iteration.
- If items are reordered, the application should update both `sortOrder` and the derived display number/code where appropriate.
- If stakeholders later require program codes to be unique across the entire plan, add a denormalized `planId` to `StrategicProgram` or validate uniqueness through traversal in the service layer.

---

## 6. KPI Renumbering Migration (prerequisite)

Add structured codes and make Standard / KPI numbering **continuous within a
template**, instead of resetting per parent.

```prisma
model KpiDomain   { code String @db.Text legacyCode String? @db.Text @@unique([templateId, code]) ... }
model KpiStandard { code String @db.Text legacyCode String? @db.Text templateId String @map("template_id") @@unique([templateId, code]) ... }
model Kpi         { code String @db.Text legacyCode String? @db.Text templateId String @map("template_id") @@unique([templateId, code]) ... }
```

Migration steps (`prisma/migrations/<ts>_kpi_codes_and_renumbering/`):

1. Add nullable `code` and `legacyCode` columns.
2. Add nullable denormalized `template_id` FK on `kpi_standards` and `kpis` if
   the existing schema does not already expose direct template-level uniqueness.
3. Backfill `template_id` from existing relationships:
   - `KpiStandard.templateId` from its parent domain/template.
   - `Kpi.templateId` from standard → domain → template.
4. Backfill legacy codes before changing numbering:
   - Preserve any existing displayed code/label if available.
   - If no existing code exists, populate `legacyCode` with the previous composed
     or display label used in the UI, where feasible.
5. Backfill new codes:
   - `KpiDomain.code = "D" + sortOrder` (per template).
   - `KpiStandard.code = "S" + globalIndex(template)` — assigned by walking
     domains in `sortOrder`, then standards in `sortOrder`, incrementing one
     counter across the template.
   - `Kpi.code = "K" + globalIndex(template)` — same approach across all KPIs in
     the template.
6. Make `code` and denormalized `template_id` columns `NOT NULL`, add unique
   constraints.
7. Update seed scripts (`scripts/seed-head-of-*-framework.ts`) to write codes,
   `legacyCode` where relevant, and denormalized `templateId` explicitly going
   forward.
8. Verify existing appraisal/KPI UI still renders correctly after renumbering.

The full coverage label shown in UI is composed at read-time as
`${domain.code}.${standard.code}.${kpi.code}` (e.g. `D1.S2.K1`).

Important invariant: if standards/KPIs can ever be moved between templates, the
application must keep denormalized `templateId` consistent with the parent
relationships. If moving between templates is not supported, API validation
should explicitly reject such changes.

---

## 7. URL & Page Map (Next.js App Router)

```text
/strategic-plans                                      List of plans (filtered by visibility)
/strategic-plans/new                                  Create plan (manager of dept w/o plan only; admin/director any dept)
/strategic-plans/[planId]                             Plan overview + roll-up + tree
/strategic-plans/[planId]/edit                        Edit metadata (name, vision, mission, years)
/strategic-plans/[planId]/goals/[goalId]              Goal detail (objectives & programs list)
/strategic-plans/[planId]/programs/[programId]        Program detail (full editor)
/strategic-plans/[planId]/budget                      Budget view aggregated by period
/strategic-plans/[planId]/print                       Print-friendly read-only view
```

Top-level nav entry: **Strategic Plans** (visible to all signed-in users; the
list view itself enforces draft vs published filtering).

The print route renders the full plan using A4-friendly print styles and may span
multiple pages.

---

## 8. UI Components

- `PlanList` — cards per department; shows status, owner, period progress bar.
- `PlanOverview` — header (dept, vision/mission, years), KPI roll-up donut,
  Goals tree.
- `GoalCard` / `ObjectiveCard` / `ProgramCard` — collapsible nested rendering.
- `ProgramEditor` — tabs: Overview · Checklist · KPI Coverage · Period Targets ·
  Collaborators · Budget · Updates.
- `KpiPicker` — search by `D{n}.S{n}.K{n}` code or text; restricted to KPI
  templates relevant to the department (or all, configurable).
- `PeriodTargetGrid` — 5 rows (one per period); columns: target, actual, status,
  evidence.
- `BudgetTable` — line items per period with totals across periods/programs.
- `CollaboratorChips` — multi-select of other Departments. Owner department is
  excluded from selectable collaborators.
- `ProgressTimeline` — reverse-chronological feed of `ProgramProgressUpdate`.
- `PlanHealthRollup` — counts of programs by `ProgramStatus`, per Goal and
  overall.

All UI uses existing shadcn/ui primitives + Tailwind, consistent with current
glassmorphism style.

---

## 9. API (Next.js Route Handlers)

All `POST/PATCH/DELETE` go through a write guard (`canWriteStrategicPlan`) except
read endpoints which use `canReadStrategicPlan`. Delete uses
`canDeleteStrategicPlan`.

```text
GET    /api/strategic-plans
POST   /api/strategic-plans                         { departmentId, name, startYear, ... }
GET    /api/strategic-plans/:planId
PATCH  /api/strategic-plans/:planId
POST   /api/strategic-plans/:planId/publish
POST   /api/strategic-plans/:planId/unpublish
DELETE /api/strategic-plans/:planId

POST   /api/strategic-plans/:planId/goals
PATCH  /api/strategic-goals/:goalId
DELETE /api/strategic-goals/:goalId

POST   /api/strategic-goals/:goalId/objectives
PATCH  /api/strategic-objectives/:objectiveId
DELETE /api/strategic-objectives/:objectiveId

POST   /api/strategic-objectives/:objectiveId/programs
GET    /api/strategic-programs/:programId
PATCH  /api/strategic-programs/:programId
DELETE /api/strategic-programs/:programId

PUT    /api/strategic-programs/:programId/checklist        (bulk replace)
PUT    /api/strategic-programs/:programId/kpi-links        (bulk replace by Kpi IDs or resolvable codes)
PUT    /api/strategic-programs/:programId/targets          (bulk update/upsert 1 per period)
PUT    /api/strategic-programs/:programId/collaborators    (bulk replace)
PUT    /api/strategic-programs/:programId/budget           (bulk replace)
POST   /api/strategic-programs/:programId/updates          (append progress note + update program status)

POST   /api/strategic-programs/:programId/targets/:periodId/evidence
       (multipart upload → MinIO `strategic-plans/{planId}/{programId}/{periodId}/{safeFilename}`)
```

Bulk replace/update endpoints must run in a database transaction: validate all
rows, apply the full mutation, and return the updated collection. For period
targets, prefer update/upsert over delete/recreate so target IDs and evidence
associations remain stable.

KPI links are FK-backed from the start. When the client submits a code such as
`D1.S2.K1`, the backend resolves it to `Kpi.id`. Free-text KPI coverage without a
real `Kpi` record is not supported in this iteration.

---

## 10. Lifecycle Rules

- On `StrategicPlan` create: server computes `endYear = startYear + 4` and
  auto-creates exactly 5 `StrategicPeriod` rows (`startYear … startYear+4`).
- On `StrategicProgram` create: auto-create 5 empty `ProgramPeriodTarget` rows
  (one per existing period) so the editor grid is never empty.
- Budget lines are **not** auto-created. Managers add budget lines only when
  needed.
- Period extension and rolling plans are out of scope for this iteration.
- A plan can be **unpublished back to draft** by manager/director/admin.
- Deleting a plan cascades all children (`onDelete: Cascade`) and is restricted
  to director/admin.

---

## 11. Visibility and Authorization Rules (concrete)

```text
isManagerOfDepartment(user, departmentId):
  if user.role != 'manager' → false
  if user.profile.departmentId == departmentId → true
  if user has manager-equivalent DepartmentRole for departmentId → true
  else → false

canReadStrategicPlan(plan, user):
  if no signed-in user → false
  if plan.status == 'published' → true
  if user.role in {'director', 'admin'} → true
  if isManagerOfDepartment(user, plan.departmentId) → true
  else → false

canWriteStrategicPlan(plan, user):
  if no signed-in user → false
  if user.role in {'director', 'admin'} → true
  if isManagerOfDepartment(user, plan.departmentId) → true
  else → false

canCreateStrategicPlan(departmentId, user):
  if no signed-in user → false
  if department already has a plan → false
  if user.role in {'director', 'admin'} → true
  if isManagerOfDepartment(user, departmentId) → true
  else → false

canDeleteStrategicPlan(plan, user):
  if no signed-in user → false
  if user.role in {'director', 'admin'} → true
  else → false
```

API authorization must enforce these rules even if the UI hides unavailable
actions.

---

## 12. Status Semantics

- `StrategicProgram.status` is the overall current program status and is manually
  set by an authorized manager/director/admin.
- `ProgramPeriodTarget.status` is the status for a specific year/period target.
- Updating a progress note through `POST /updates` records the note/status and
  updates `StrategicProgram.status`.
- Updating a period target status does not automatically create a progress update
  and does not automatically change `StrategicProgram.status`.
- Plan/goal rollups use `StrategicProgram.status` by default.
- Period-filtered views may use `ProgramPeriodTarget.status` explicitly.

---

## 13. Validation Rules

- `startYear` must be reasonable (`>= 2000` and `<= 2100`).
- `endYear` is server-derived and cannot be set directly by the client.
- `departmentId` must be unique across all strategic plans.
- `amountIdr >= 0`.
- `targetText` may be empty for auto-seeded placeholders, but publishing should
  warn if required planning fields are incomplete.
- Program, goal, and objective titles are required.
- Collaborator department cannot equal the owner department.
- Duplicate collaborator departments are rejected.
- Duplicate KPI links for the same program are rejected.
- KPI links must reference existing `Kpi` records and must satisfy any configured
  department/template restriction.
- Publishing requires at least one goal, one objective, and one program unless
  stakeholders explicitly allow publishing an empty plan.
- Duplicate plan creation for the same department returns a graceful validation
  error.

---

## 14. Evidence Upload Rules

- Evidence uploads require write access to the parent strategic plan.
- Files are stored in the existing MinIO bucket under
  `strategic-plans/{planId}/{programId}/{periodId}/{safeFilename}`.
- Store only the MinIO object key in `ProgramPeriodTarget.evidenceKey`.
- Signed URLs are generated at read time for authorized readers.
- Enforce max file size and allowed MIME types using the project's existing file
  upload conventions where available.
- Sanitize filenames and do not trust client-provided paths.
- Reject uploads for targets that do not belong to the specified program/plan.

---

## 15. Audit / History Scope

Plans are live documents and can be edited after publication. This iteration does
**not** provide full structural change history for edits to plan metadata, goals,
objectives, programs, targets, budget lines, collaborators, KPI links, or
checklist items.

Only `ProgramProgressUpdate` is historized in this iteration. It records manager
notes and program status changes. A future version may add a general
`StrategicPlanActivity` audit log if stakeholders require full change tracking.

---

## 16. Acceptance Criteria

1. A department manager without an existing plan sees a **"Create Strategic
   Plan"** CTA on `/strategic-plans`. After creating with `startYear = 2026`,
   the plan has exactly 5 periods (2026..2030) auto-seeded.
2. Admin/director can create a plan for any department. Manager can create only
   for their own department. Duplicate plan creation for the same department
   fails gracefully.
3. The same manager can add 3 Goals, 9 Objectives, 24 Programs and persist them
   across reloads.
4. For each Program the manager can: tick checklist items, link ≥1 existing KPI
   by `D{n}.S{n}.K{n}` code, fill the 5-period target grid, attach collaborator
   departments, add budget lines per period, and post progress updates that
   change `StrategicProgram.status`.
5. A manager from another department cannot view a draft plan and cannot edit any
   plan outside their department.
6. A staff user navigating to a **draft** plan gets a 403/redirect; once
   published they see a read-only view.
7. Staff can see the top-level `/strategic-plans` route, but the list only shows
   plans they are allowed to read.
8. KPI codes display as `D1.S2.K1` and are unique within the rubric template
   (verified by the new migration constraint). Legacy labels are preserved where
   feasible via `legacyCode`.
9. The `/print` route renders the entire plan with A4-friendly print styles,
   allowing multiple pages, and mirrors the source RTF structure (Goal →
   Objective → Program with checklist, KPI coverage, period targets,
   collaborators, budget).
10. Budget totals roll up: per program (across periods), per period (across
    programs), per plan.
11. Evidence uploads land in MinIO under `strategic-plans/<planId>/...`, store
    only the object key, and are served to authorized readers via signed URLs.
12. API write attempts from unauthorized users return 403 even if UI controls are
    hidden.
13. Collaborator departments are visible on published plans but cannot edit the
    plan unless they independently satisfy write authorization.

---

## 17. Phased Delivery

**Phase 0 — KPI codification migration**
- Add `code`, `legacyCode`, and denormalized `templateId` where needed.
- Backfill codes and legacy references.
- Renumber standards/KPIs continuously per template.
- Update seed scripts.
- Verify existing appraisal/KPI UI still works.

**Phase 1 — MVP author/read with FK-backed KPI links**
- Schema for plans/goals/objectives/programs/checklist/periods/targets/KPI links.
- CRUD UI + APIs.
- Visibility/authorization guards.
- Top-level nav entry.
- KPI linking by code or picker, persisted as `Kpi.id` FK.
- No budget/collaborators/evidence/print yet unless trivial to include.

**Phase 2 — Roll-ups and progress timeline**
- Plan overview roll-up (status counts per Goal and overall).
- Program status timeline using `ProgramProgressUpdate`.
- KPI picker polish and department/template restrictions.

**Phase 3 — Budget, collaborators, evidence, print**
- Budget table + totals.
- Collaborator chips.
- MinIO evidence uploads on period targets.
- Print view.

**Phase 4 — Cross-link with appraisals (optional)**
- On Program detail, surface evidence already submitted in `Assessment` records
  that target the linked `Kpi.id`s within the period.

---

## 18. Risks & Open Items

- **R1**: Renumbering KPI codes mid-cycle could confuse staff who memorized old
  labels. Mitigation: communicate ahead and populate `legacyCode` where feasible
  for reference.
- **R2**: Department managers without a `Profile.departmentId` or DepartmentRole
  grant cannot create plans — admin must ensure assignments first.
- **R3**: Denormalized KPI `templateId` on standards/KPIs can drift if records are
  moved between templates. Mitigation: disallow moves or update the denormalized
  field transactionally.
- **R4**: Live edits after publication do not have full structural history in this
  iteration. Mitigation: make this explicit; add audit log later if required.
- **O1**: Whether published plans should also be visible to anonymous viewers
  (e.g., parents) is **out of scope** for now.
- **O2**: Whether program codes should be unique within an objective or across the
  whole plan may need stakeholder confirmation if printed documents depend on
  plan-wide codes.

---

## 19. Out of Scope (this iteration)

- Multi-currency budgets.
- Automatic status inference from KPI scores.
- Gantt / dependency views.
- Approval workflow for plan changes.
- Full structural audit log/version history.
- Period extension / rolling strategic plans.
- Anonymous/public plan visibility.
- RTF import.

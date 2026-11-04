# Rubric Fill-In Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive fill-in preview dialog when adding or editing rubrics in KPI Framework / Staff Appraisals and Observation Forms.

**Architecture:** Extract pure preview state normalization helpers (`src/components/rubrics/rubric-preview-utils.ts`) covered by Node unit tests, then build two interactive preview dialog components (`KpiRubricPreviewDialog.tsx` and `ObservationRubricPreviewDialog.tsx`) that reuse the existing assessment and observation form fill-in UI and wire them into `src/app/rubrics/page.tsx` and `src/components/admin/ObservationFormEditor.tsx`.

**Tech Stack:** Next.js 15, React 18, TypeScript, Radix UI Dialog & Accordion, Tailwind CSS, `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-04-rubric-preview-design.md`

## Global Constraints

- Preview mode must be 100% client-side and never call any API or persist responses.
- Opening or closing the preview must preserve all unsaved rubric edits in the underlying editor.
- Banner copy must include `"Preview Mode — Responses are for testing only and will not be saved."` and provide a `"Reset Responses"` action.
- Both editors (`src/app/rubrics/page.tsx` and `src/components/admin/ObservationFormEditor.tsx`) must reflect in-flight unsaved edits inside the preview.

## Review Focus

- Newly added KPI or indicator with blank name/rubric descriptions should fall back to readable labels (`"Untitled Domain"`, `"Untitled Standard"`, `"Untitled KPI"`, `"Untitled Section"`, `"Untitled Indicator"`) instead of rendering empty headers.
- In `ObservationFormEditor`, an open `editingIndicator` with a typed but un-clicked `newOption` on a `CHOICE` question should include that pending option in the preview options list without duplicates.
- In `AssessmentSection`, a domain with `0` KPIs divides `0 / 0` (`NaN%` progress); the preview must guard or handle empty domains/standards gracefully.
- Editing a rubric after previously interacting with the preview and reopening the preview should sync new/updated domains, standards, KPIs, or indicators while preserving or cleanly resetting local trial answers.
- `CHOICE` indicators in `ObservationFormEditor` with `question_type !== "CHOICE"` should ignore stale `score_options`, while `CHOICE` indicators with empty options should fall back to text input matching `ObservationFormEditor`.

---

### Task 1: Pure Preview State Normalization Helpers & Unit Tests

**Files:**
- Create: `src/components/rubrics/rubric-preview-utils.ts`
- Test: `src/components/rubrics/rubric-preview-utils.test.ts`

**Interfaces:**
- Consumes: `DomainData`, `KPIData` from `@/components/assessment`; `ObservationRubricSection`, `ObservationQuestionType` from `@/features/observations/types`
- Produces:
  - `export interface RawKpiTemplateInput { id?: string; name?: string | null; description?: string | null; domains?: Array<{ id: string; name?: string | null; weight?: number | null; standards?: Array<{ id: string; name?: string | null; kpis?: Array<{ id: string; name?: string | null; description?: string | null; evidence_guidance?: string | null; trainings?: string | null; rubric_4?: string | null; rubric_3?: string | null; rubric_2?: string | null; rubric_1?: string | null }> }> }> }`
  - `export function buildKpiPreviewDomains(template: RawKpiTemplateInput | null | undefined, existingResponses?: Record<string, { score: number | "X" | null; evidence: KPIData["evidence"] }>): DomainData[]`
  - `export function applyKpiPreviewUpdate(domains: DomainData[], kpiId: string, updates: Partial<KPIData>): DomainData[]`
  - `export interface RawObservationPreviewSource { selected: { id: string; name?: string | null; description?: string | null; sections?: Array<{ id: string; name?: string | null; weight?: number | null; sort_order?: number | null; indicators?: Array<{ id: string; name?: string | null; description?: string | null; evidence_guidance?: string | null; question_type?: string | null; score_options?: string[] | null; is_required?: boolean | null; sort_order?: number | null }> }> } | null; editingTemplateInfo?: boolean; editName?: string; editDescription?: string; editingSectionId?: string | null; editingSectionName?: string; editingIndicator?: { id: string; name: string; description: string; evidence_guidance: string; question_type: string; score_options: string[]; is_required: boolean; newOption?: string } | null }`
  - `export function buildObservationPreviewTemplate(source: RawObservationPreviewSource): { id: string; name: string; description: string | null; sections: ObservationRubricSection[] } | null`

- [ ] **Step 1: Write the failing unit tests in `src/components/rubrics/rubric-preview-utils.test.ts`**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyKpiPreviewUpdate,
  buildKpiPreviewDomains,
  buildObservationPreviewTemplate,
} from "./rubric-preview-utils";

test("buildKpiPreviewDomains normalizes blank names and preserves existing trial responses", () => {
  const domains = buildKpiPreviewDomains(
    {
      name: "Teacher Appraisal",
      domains: [
        {
          id: "d-1",
          name: "   ",
          weight: 40,
          standards: [
            {
              id: "s-1",
              name: "",
              kpis: [
                {
                  id: "k-1",
                  name: "  ",
                  description: "Desc",
                  evidence_guidance: "Guide",
                  trainings: "Training A",
                  rubric_4: "R4",
                  rubric_3: "R3",
                  rubric_2: "R2",
                  rubric_1: "R1",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      "k-1": { score: 4, evidence: [{ id: "1", title: "Doc", evidence: "https://example.com" }] },
    },
  );

  assert.equal(domains.length, 1);
  assert.equal(domains[0].name, "Untitled Domain");
  assert.equal(domains[0].standards[0].name, "Untitled Standard");
  assert.equal(domains[0].standards[0].kpis[0].name, "Untitled KPI");
  assert.equal(domains[0].standards[0].kpis[0].score, 4);
});

test("applyKpiPreviewUpdate updates only the targeted KPI score and evidence", () => {
  const initial = buildKpiPreviewDomains({
    domains: [
      {
        id: "d-1",
        name: "Domain 1",
        weight: 100,
        standards: [
          {
            id: "s-1",
            name: "Standard 1",
            kpis: [
              { id: "k-1", name: "KPI 1", rubric_4: "4", rubric_3: "3", rubric_2: "2", rubric_1: "1" },
              { id: "k-2", name: "KPI 2", rubric_4: "4", rubric_3: "3", rubric_2: "2", rubric_1: "1" },
            ],
          },
        ],
      },
    ],
  });

  const updated = applyKpiPreviewUpdate(initial, "k-2", { score: 3 });
  assert.equal(updated[0].standards[0].kpis[0].score, null);
  assert.equal(updated[0].standards[0].kpis[1].score, 3);
});

test("buildObservationPreviewTemplate merges in-flight template, section, and indicator edits including pending newOption", () => {
  const preview = buildObservationPreviewTemplate({
    selected: {
      id: "obs-1",
      name: "Original Form",
      description: "Original Desc",
      sections: [
        {
          id: "sec-1",
          name: "Original Section",
          indicators: [
            {
              id: "ind-1",
              name: "Original Indicator",
              description: "Old desc",
              evidence_guidance: "Old guide",
              question_type: "SCALE",
              score_options: null,
              is_required: true,
            },
          ],
        },
      ],
    },
    editingTemplateInfo: true,
    editName: "Updated Form Name",
    editDescription: "Updated Form Desc",
    editingSectionId: "sec-1",
    editingSectionName: "Updated Section Name",
    editingIndicator: {
      id: "ind-1",
      name: "Updated Indicator",
      description: "New desc",
      evidence_guidance: "New guide",
      question_type: "CHOICE",
      score_options: ["Yes", "Partially"],
      is_required: false,
      newOption: "No",
    },
  });

  assert.ok(preview);
  assert.equal(preview.name, "Updated Form Name");
  assert.equal(preview.description, "Updated Form Desc");
  assert.equal(preview.sections[0].name, "Updated Section Name");
  assert.equal(preview.sections[0].indicators[0].name, "Updated Indicator");
  assert.equal(preview.sections[0].indicators[0].questionType, "CHOICE");
  assert.equal(preview.sections[0].indicators[0].isRequired, false);
  assert.deepEqual(preview.sections[0].indicators[0].scoreOptions, [
    "Yes",
    "Partially",
    "No",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test src/components/rubrics/rubric-preview-utils.test.ts`
Expected: FAIL with module not found `./rubric-preview-utils`

- [ ] **Step 3: Implement `src/components/rubrics/rubric-preview-utils.ts` and guard 0-KPI division in `src/components/assessment/AssessmentSection.tsx`**

Implement `buildKpiPreviewDomains`, `applyKpiPreviewUpdate`, and `buildObservationPreviewTemplate` in `src/components/rubrics/rubric-preview-utils.ts`. Also update `src/components/assessment/AssessmentSection.tsx` line 72 so `progressPercentage` is `totalKPIs > 0 ? Math.round((completedKPIs / totalKPIs) * 100) : 0` and `isComplete` is `totalKPIs > 0 && completedKPIs === totalKPIs`.

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npx tsx --test src/components/rubrics/rubric-preview-utils.test.ts`
Expected: PASS (3 passing tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/rubrics/rubric-preview-utils.ts src/components/rubrics/rubric-preview-utils.test.ts src/components/assessment/AssessmentSection.tsx
git commit -m "feat(rubrics): add preview state normalization utilities and tests"
```

---

### Task 2: KPI / Staff Appraisal Interactive Preview Dialog & Editor Wiring

**Files:**
- Create: `src/components/rubrics/KpiRubricPreviewDialog.tsx`
- Modify: `src/app/rubrics/page.tsx`

**Interfaces:**
- Consumes: `buildKpiPreviewDomains`, `applyKpiPreviewUpdate`, `RawKpiTemplateInput` from `./rubric-preview-utils`; `AssessmentSection`, `WeightedScoreDisplay`, `AssessmentProgress` from `@/components/assessment`; `calculateWeightedScore` from `@/hooks/useAssessment`
- Produces: `export function KpiRubricPreviewDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (open: boolean) => void; template: RawKpiTemplateInput | null })`

- [ ] **Step 1: Create `src/components/rubrics/KpiRubricPreviewDialog.tsx`**

Build the dialog component with:
- Header showing template name, description, and `"Preview as Staff / Appraisee"` badge.
- Alert banner with exact copy `"Preview Mode — Responses are for testing only and will not be saved."` and a `"Reset Responses"` button (`RotateCcw` icon) that clears trial ratings and evidence.
- Main 2-column layout mirroring `src/app/assessment/page.tsx`:
  - Left (`lg:col-span-8`): `<Accordion type="multiple">` initialized with all domain IDs expanded, rendering `<AssessmentSection>` for each domain so users can expand KPIs, pick scores (`1`–`4` or `'X'`), and fill in evidence items. Empty state if the template has no domains yet.
  - Right (`lg:col-span-4`): `<WeightedScoreDisplay domains={domains} score={weightedScore} label="Projected Score" type="staff" showAlways={true} />` plus a completion summary card showing completed vs total KPIs.

- [ ] **Step 2: Wire `KpiRubricPreviewDialog` into `src/app/rubrics/page.tsx`**

In `src/app/rubrics/page.tsx`:
- Import `Eye` from `lucide-react` and `KpiRubricPreviewDialog` from `@/components/rubrics/KpiRubricPreviewDialog`.
- Add `const [previewOpen, setPreviewOpen] = useState(false);` inside `RubricsContent`.
- In the Action Bar (around line 1130), add a `<Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4 mr-2" />Preview Fill-In</Button>` visible both when `isEditMode` is true and when `isEditMode` is false (so users can preview saved templates as well as live unsaved edits in `currentData`).
- Render `<KpiRubricPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} template={currentData} />` at the bottom of `RubricsContent`.

- [ ] **Step 3: Verify TypeScript compilation and tests**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/rubrics/KpiRubricPreviewDialog.tsx src/app/rubrics/page.tsx
git commit -m "feat(rubrics): add interactive fill-in preview for KPI and staff appraisal rubrics"
```

---

### Task 3: Observation Form Interactive Preview Dialog & Editor Wiring

**Files:**
- Create: `src/components/rubrics/ObservationRubricPreviewDialog.tsx`
- Modify: `src/components/admin/ObservationFormEditor.tsx`

**Interfaces:**
- Consumes: `buildObservationPreviewTemplate`, `RawObservationPreviewSource` from `./rubric-preview-utils`; `calculateObservationProgress`, `findIncompleteRequiredIndicators`, `isObservationAnswerComplete` from `@/features/observations/validation`; `ObservationRubricIndicator` from `@/features/observations/types`
- Produces: `export function ObservationRubricPreviewDialog({ open, onOpenChange, source }: { open: boolean; onOpenChange: (open: boolean) => void; source: RawObservationPreviewSource })`

- [ ] **Step 1: Create `src/components/rubrics/ObservationRubricPreviewDialog.tsx`**

Build the dialog component mirroring `src/features/observations/components/ObservationFormEditor.tsx`:
- Header with form name, description, and required progress bar (`progress.requiredAnswered / progress.requiredTotal` and `Progress` bar).
- Alert banner with exact copy `"Preview Mode — Responses are for testing only and will not be saved."` and a `"Reset Responses"` button.
- Left section navigator showing each section's required completion count (`answered/total required`) and status icon (`CheckCircle2` vs `Clock3`), plus a right/top summary of incomplete required indicators and optional answered count.
- Main section list rendering each indicator card with its question type badge (`SCALE`, `TEXT`, `CHOICE`), `Required`/`Optional` badge, description, evidence guidance box, and interactive controls:
  - `SCALE`: Numeric score input (`1–100` with whole-number validation message matching `ObservationFormEditor`) + Notes textarea.
  - `TEXT`: Response textarea.
  - `CHOICE`: Radio option cards when `scoreOptions.length > 0`, or fallback text input when `scoreOptions` is empty.

- [ ] **Step 2: Wire `ObservationRubricPreviewDialog` into `src/components/admin/ObservationFormEditor.tsx`**

In `src/components/admin/ObservationFormEditor.tsx`:
- Import `Eye` from `lucide-react` and `ObservationRubricPreviewDialog` from `@/components/rubrics/ObservationRubricPreviewDialog`.
- Add `const [previewOpen, setPreviewOpen] = useState(false);`.
- In the Form Details card header (and/or Sections & Indicators header when `selected` is present), add a `<Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview Form</Button>`.
- Render `<ObservationRubricPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} source={{ selected, editingTemplateInfo, editName, editDescription, editingSectionId, editingSectionName, editingIndicator }} />`.

- [ ] **Step 3: Run domain tests, preview tests, and TypeScript check**

Run: `npx tsx --test src/components/rubrics/rubric-preview-utils.test.ts src/features/observations/server/observation-domain.test.ts && npx tsc --noEmit`
Expected: PASS with all tests passing and 0 TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/rubrics/ObservationRubricPreviewDialog.tsx src/components/admin/ObservationFormEditor.tsx
git commit -m "feat(observations): add interactive fill-in preview to observation form editor"
```

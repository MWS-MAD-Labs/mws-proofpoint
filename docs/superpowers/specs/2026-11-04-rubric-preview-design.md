# Rubric Fill-In Preview Design Spec

## Intent & Why
When creating or editing a KPI Framework / Staff Appraisal rubric (`src/app/rubrics/page.tsx`) or an Observation Form (`src/components/admin/ObservationFormEditor.tsx`), authors need to see and test how the rubric feels to fill out before saving or publishing changes.

## Goals
- Provide a `Preview` button in the KPI Framework / Staff Appraisal rubric editor (`src/app/rubrics/page.tsx`) whenever a template is selected (both in view mode and in edit/add mode, reflecting unsaved `editData`).
- Provide a `Preview` button in the Observation Form editor (`src/components/admin/ObservationFormEditor.tsx`) whenever a form template is selected, reflecting live edits (including unsaved template title/description, section name, and indicator edits currently open in `editingIndicator` including any typed `newOption`).
- Open an interactive modal dialog that renders the fill-in experience:
  - **KPI / Staff Appraisal Preview:** Uses `AssessmentSection` (with `AssessmentIndicator`, `ScoreSelector`, `EvidenceInput`) and `WeightedScoreDisplay` so authors can expand domains, select 1–4 or X ratings, enter evidence items, and see domain & weighted score calculation in real time.
  - **Observation Form Preview:** Renders sections, required/optional progress (`calculateObservationProgress` / `isObservationAnswerComplete`), and interactive inputs for `SCALE` (1–100 score + notes), `TEXT` (narrative textarea), and `CHOICE` (radio options or fallback input) matching `src/features/observations/components/ObservationFormEditor.tsx`.
- Display a clear banner: `"Preview Mode — Responses are for testing only and will not be saved."` and a `"Reset Responses"` button.

## Non-Goals & Anti-Goals
- Never call any API or persist preview responses to the database.
- Do not navigate away from `/rubrics` or lose current unsaved rubric edits when opening or closing the preview.

## Approaches Considered
1. **Interactive Preview Dialog (Chosen):** Opens a large (`max-w-6xl`) scrollable modal over the editor with local trial state initialized from the current draft template. Preserves editor state and scroll position.
2. **Inline Edit/Preview Mode Toggle:** Switches the main canvas between editor and preview. Rejected because it displaces the editing context.

## Architecture & Interfaces
- `src/components/rubrics/rubric-preview-utils.ts`: Pure data-transformation helpers (`buildKpiPreviewDomains`, `applyKpiPreviewUpdate`, `buildObservationPreviewTemplate`) so live editor state (including unsaved inline edits and empty domains/sections) converts cleanly into preview models and can be unit-tested with `tsx --test`.
- `src/components/rubrics/KpiRubricPreviewDialog.tsx`: Interactive KPI / Staff Appraisal fill-in preview dialog reusing `AssessmentSection` and `WeightedScoreDisplay`.
- `src/components/rubrics/ObservationRubricPreviewDialog.tsx`: Interactive Observation Form fill-in preview dialog reusing `calculateObservationProgress`, `findIncompleteRequiredIndicators`, and `isObservationAnswerComplete`.

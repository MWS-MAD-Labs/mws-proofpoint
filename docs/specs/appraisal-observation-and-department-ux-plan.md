# Appraisal, Observation, and Department Administration UX — Implementation Plan

**Specification:** `docs/specs/appraisal-observation-and-department-ux.md`  
**Constitution:** `.specify/memory/constitution.md`  
**Status:** Implemented — authenticated browser validation pending

## 1. Delivery strategy

Implement the four user-facing outcomes as focused increments while preserving existing appraisal, observation, and organizational data models:

1. Expose self-assessment KPI controls in the normal document flow without changing scoring, evidence, assignment, or lifecycle behavior.
2. Enforce observation confidentiality at the shared server permission and SQL visibility boundaries, then prove the behavior through database-backed query and route tests.
3. Make the active-appraisal decision dialog responsive, scroll-safe, keyboard-operable, and explicit about destructive actions.
4. Replace dense recursive department cards with a searchable hierarchy navigator and focused department detail surface that reuses existing management dialogs.
5. Run automated quality checks and the constitution-mandated authenticated browser matrix before declaring validation complete.

## 2. Architecture and constraints

- Retain the existing Next.js App Router, TypeScript, Tailwind, Radix, and shadcn-style component architecture.
- Do not introduce a schema migration, dependency, observation state, personnel model, or parallel assignment workflow.
- Keep observation authorization server-side. UI hiding is supplementary and must not be the security boundary.
- Reuse `getObservationPermissions`, observation query functions, existing route handlers, department APIs, and role-assignment dialogs.
- Use semantic design-token classes and existing shared components.
- Preserve existing user changes and avoid unrelated lint cleanup.

## 3. Implementation increments

### Increment A — Self-assessment presentation

**Requirements:** FR-001–FR-007, AC-001–AC-003, SC-001

- Add an always-expanded presentation path to assessment sections and KPI indicators.
- Render editable/read-only KPI content without requiring domain, standard, or KPI expansion.
- Preserve saved values, score calculation, evidence requirements, draft saving, and submission validation.

**Validation:** TypeScript, focused lint, build, then authenticated desktop/mobile/200%-zoom/keyboard/light-dark browser checks.

### Increment B — Observation confidentiality

**Requirements:** FR-008–FR-014, AC-004–AC-007, NFR-003, SC-002

- Centralize draft/reopened subject privacy in `getObservationPermissions`.
- Apply actor visibility to list rows, filtered totals, summary counts, attention lists, recent lists, search, and pagination.
- Deny direct detail and answer-route access for staff subjects while records are draft/reopened.
- Preserve submitted read-only/acknowledgment access and existing admin, director, and assigned-manager privileges.
- Ensure reopen notifications do not expose the hidden record to staff.

**Validation:** Database-backed query and route integration tests covering list, summary, detail, answers, submit, acknowledge, reopen, pagination, search, and privileged roles.

### Increment C — Active-appraisal dialog

**Requirements:** FR-015–FR-019, AC-008–AC-009, SC-003

- Constrain dialog height and width to the dynamic viewport.
- Allow vertical scrolling and text wrapping for long staff/rubric names.
- Stack/reflow actions at narrow widths and preserve destructive semantics.
- Keep controls keyboard focusable and disable duplicate destructive requests.

**Validation:** Authenticated draft/non-draft scenarios at desktop, mobile, 200% zoom, keyboard-only, light, and dark themes.

### Increment D — Department Structure

**Requirements:** FR-020–FR-028, AC-010–AC-012, SC-004

- Provide searchable root/nested hierarchy navigation with branch expansion and selected ancestry.
- Show manager/staff counts and focused assignment panels.
- Reuse department edit/delete and departmental role/member management flows.
- Preserve selected hierarchy context while management dialogs open and close.
- Represent global director/admin roles separately.
- Use standard buttons and tab navigation rather than declaring an incomplete ARIA tree pattern.

**Validation:** Empty, single-root, multiple-root, deep hierarchy, nested search/reveal, keyboard, mobile, and light/dark browser checks.

### Increment E — Quality and artifact synchronization

**Requirements:** NFR-001–NFR-005, SC-005, Constitution §§5–6

- Run focused tests first, followed by TypeScript, focused lint, build, and relevant diagnostics.
- Record warnings separately from errors.
- Persist the plan and task checklist in `docs/specs/`.
- Keep the feature lifecycle status explicitly pending until authenticated browser validation is complete.

## 4. Validation environment requirements

Authenticated browser validation must run against the current working-tree build with representative staff, manager, director, and admin accounts and data for:

- multi-domain editable and read-only self-assessments;
- active draft and non-draft appraisal conflicts with long names;
- empty, multiple-root, and deeply nested departments;
- draft, submitted, acknowledged, and reopened observations.

The browser matrix must record viewport, zoom, theme, keyboard path, result, and any defect. A published container image or a different revision is not acceptable evidence for the current implementation.

## 5. Completion rule

The implementation may be described as code-complete when automated checks pass, but the specification must not be marked validation-complete or approved until every required browser scenario has direct recorded evidence.
# Appraisal, Observation, and Department Administration UX — Specification

**Status:** Implemented — authenticated browser validation pending

## 1. Purpose

Improve the speed and clarity of the appraisal and organization-management workflows while preserving the existing assessment and observation records.

This feature has four outcomes:

1. A self-assessment can be completed with all KPI inputs available without repeatedly opening KPI groups.
2. A staff member cannot discover, list, open, or receive details of an in-progress observation. They can access an observation only once it is finalized for their acknowledgment.
3. The active-appraisal confirmation dialog remains fully readable and operable at supported viewport widths and zoom levels.
4. Administrators can understand and manage a department hierarchy, its managers, and its staff without navigating through dense nested cards.

The evidence-first principle remains unchanged: a score may not be treated as complete where the existing evidence rules require evidence.

## 2. Existing Product Constraints

- Manager-led staff appraisals remain governed by `docs/specs/manager-led-staff-appraisals.md`. Staff cannot create or change manager-led appraisal scores, evidence, or feedback.
- The current observation lifecycle is `draft` → `submitted` → `acknowledged`. For this specification, **finalized for acknowledgment** means the `submitted` state. It does not mean merely saved, in progress, overdue, or reopened.
- Self-assessments retain the current rubric structure, KPI scores, evidence, validation, weighted score calculations, save-draft behavior, and submission lifecycle.
- Department hierarchy, user accounts, global roles, and departmental role assignments remain the authoritative organizational data. This feature does not change reporting lines or create a new personnel model.
- User-facing surfaces must follow the ProofPoint Engineering Constitution, including semantic design tokens, keyboard support, WCAG 2.1 AA contrast, responsive behavior, and light/dark theme support.

## 3. Actors

| Actor | Relevant goals |
| --- | --- |
| Staff member / self-assessor | Complete a self-assessment efficiently, including score and evidence for every KPI; acknowledge finalized observations assigned to them. |
| Assigned manager | Create, complete, submit, and manage observations for assigned staff; continue managing in-progress records. |
| Director | Retain authorized oversight of observations under existing permissions. |
| Administrator | Manage the department tree, department membership, and departmental manager/staff assignments; retain authorized observation oversight. |

## 4. User Stories

### US-1 — Complete a self-assessment without repeated expansion (P1)

**Why:** A self-assessor needs to review and complete all KPI evidence in one focused workflow rather than opening each domain or KPI group before input is possible.

**Independent test:** Start or resume a self-assessment containing multiple domains, standards, and KPIs. Verify that every KPI’s score and evidence controls can be reached in the normal page flow without opening an accordion or otherwise expanding a collapsed KPI/domain section.

### US-2 — Keep unfinished observations private from staff subjects (P1)

**Why:** Observation content, progress, and manager working notes must remain private until the manager has finalized the observation for staff acknowledgment.

**Independent test:** Sign in as the subject of an observation in `draft`; verify it cannot be found in any observation list, summary, dashboard/action surface, direct detail route, or record-response endpoint. Submit the observation, then verify that the same staff member can find and open it only for acknowledgment.

### US-3 — Present the existing-appraisal decision safely in a dialog (P2)

**Why:** Managers need to understand whether they are continuing an existing appraisal or discarding a draft, and must be able to access every choice without clipped text or controls.

**Independent test:** Trigger the active-appraisal dialog with long staff and rubric names at desktop, mobile width, and 200% browser zoom. Verify all message text and actions are visible, the actions remain usable without horizontal clipping, and destructive action remains distinguishable.

### US-4 — Manage departments and people from an understandable organization view (P2)

**Why:** Administrators need to see the reporting structure and quickly identify or change departmental manager/staff assignments without scanning repeated role cards at every hierarchy level.

**Independent test:** Given a multi-level organization with departments that have managers, staff, empty assignments, and child departments, an administrator can find a department, inspect its immediate people and child departments, open management actions for its details and assignments, and understand which people are managers versus staff without opening unrelated department nodes.

## 5. Functional Requirements

### Self-assessment presentation

- **FR-001:** The self-assessment entry and resume workflow MUST continue to use the user’s automatically assigned rubric and current appraisal period; this feature MUST NOT introduce manual rubric or period selection.
- **FR-002:** While a self-assessment is editable, the assessment page MUST render all KPI input rows in the normal reading flow by default. A user MUST NOT need to expand a domain, standard, or KPI container to reach a KPI’s score or evidence input.
- **FR-003:** The page MAY retain visible domain and standard headings to communicate the rubric hierarchy, but these headings MUST NOT hide their KPI inputs by default.
- **FR-004:** Each KPI row MUST continue to show the information and controls needed to assess it, including its description/context, score control, evidence input, existing score/evidence values, required-evidence guidance, and validation feedback.
- **FR-005:** Self-assessment completeness, progress, score calculation, draft saving, submission eligibility, and evidence requirements MUST retain their current behavior after the presentation change.
- **FR-006:** If an assessment is read-only or in a final review state, its KPI data MAY use a denser read-only presentation, but staff and authorized reviewers MUST still be able to read all applicable KPI data without forced expansion.
- **FR-007:** The self-assessment UI MUST use the staff-appraisal screen as the interaction-density reference: clear hierarchy, a compact cycle/status summary, readable KPI rows, and readily available actions. It MUST preserve self-assessment-specific evidence and scoring behavior rather than adopting the staff-appraisal data model.

### Observation confidentiality and acknowledgment

- **FR-008:** A subject staff member MUST have no access to an observation assigned to them while it is `draft`, including record metadata, rubric contents, answers, evidence, progress, activity/history, status, due date, notification-driven routes, or summary counts.
- **FR-009:** The privacy restriction in FR-008 MUST be enforced by the authorization boundary for direct record, answer/response, listing, summary, and related observation endpoints; hiding an item only in the interface is insufficient.
- **FR-010:** A staff subject MUST gain read-only access to their own observation when it reaches `submitted`, so they can review its finalized content and submit their acknowledgment. They MUST retain access after it becomes `acknowledged`.
- **FR-011:** If an observation is reopened from `submitted` or `acknowledged` to an in-progress state, the staff subject’s access MUST be removed immediately until it is submitted again. Previously acknowledged content must not remain accessible through cached UI actions or direct routes.
- **FR-012:** The assigned manager, administrators, and directors retain their existing authorized access during all observation states. This feature MUST NOT broaden any staff subject’s ability to view or edit answers, evidence, scores, or manager controls.
- **FR-013:** Staff-facing observation listings, dashboard/action counts, recent items, search results, and empty states MUST omit in-progress observations rather than exposing their existence, title, manager, due date, progress, or status.
- **FR-014:** Existing notifications and staff-facing links MUST only be sent or made actionable after the observation is finalized for acknowledgment. An invalid, stale, or manually entered staff link to an in-progress observation MUST not disclose record information.

### Active-appraisal confirmation dialog

- **FR-015:** When a manager or administrator attempts to create a staff appraisal that already has an active record for the same staff member, rubric, and period, the confirmation dialog MUST identify the staff member, review period, and rubric in a readable form.
- **FR-016:** The dialog MUST offer: cancel, continue the active appraisal, and—only when the active record is a draft—discard the draft and create a new appraisal.
- **FR-017:** Dialog content and actions MUST fit or scroll within the viewport at supported mobile/desktop widths and at 200% zoom. No text or action may render outside the dialog panel, outside the viewport, behind its boundary, or inaccessible due to overflow.
- **FR-018:** Dialog actions MUST support keyboard focus and activation, maintain a visible focus indicator, and keep the destructive discard action visually and semantically distinct from non-destructive actions.
- **FR-019:** The dialog MUST prevent duplicate destructive requests while discard/create is in progress and present a clear recoverable error if the discard/create operation fails.

### Department Structure administration

- **FR-020:** The Administration > Departments area MUST provide a department-structure view that represents parent-child hierarchy, including root departments and nested departments, in a scannable manner.
- **FR-021:** Each visible department entry MUST show its name, hierarchy position or level, immediate child-department count when applicable, and a concise, role-distinguished summary of the people assigned to that department.
- **FR-022:** The department structure MUST make manager and staff assignments clearly distinguishable. It MUST identify empty manager and staff assignments without treating an absence as an error.
- **FR-023:** Administrators MUST be able to locate a department by name and navigate directly to it without manually expanding unrelated branches. The view MUST clearly show the selected department’s ancestry/path.
- **FR-024:** Administrators MUST be able to expand/collapse a department branch and open a focused department detail surface without losing their current hierarchy context.
- **FR-025:** From a focused department detail surface, an administrator MUST be able to invoke the existing department edit capability and the existing role/member management capability for relevant roles. The UI MUST communicate the scope of each action before it is taken.
- **FR-026:** The global organization roles that do not belong to a department (currently director and administrator) MUST remain separately identifiable and manageable; they MUST NOT be misrepresented as a child department or departmental staff assignment.
- **FR-027:** The department structure MUST support an empty organization, a single root department, multiple roots, a department with no assignees, and deep nesting without presenting a broken or ambiguous hierarchy.
- **FR-028:** Department deletion MUST remain subject to existing safeguards. Before a destructive department action, the administrator MUST receive a clear warning of the department and any affected hierarchy/membership consequences supported by current business rules.

## 6. Acceptance Scenarios

### Self-assessment

- **AC-001 — All KPIs are immediately available**
  - **Given** a manager starts or resumes an editable self-assessment with more than one domain and standard
  - **When** the assessment page finishes loading
  - **Then** every KPI score and evidence control is reachable by ordinary scroll and keyboard navigation
  - **And** no domain, standard, or KPI input is hidden behind a collapsed accordion.

- **AC-002 — Existing data remains intact**
  - **Given** a self-assessment with previously saved scores and evidence
  - **When** the self-assessment is displayed in the revised UI
  - **Then** its saved values, evidence, progress, and calculated score are unchanged
  - **And** the assessor can edit/save/submit subject to the same existing validation rules.

- **AC-003 — Evidence validation still prevents incomplete submission**
  - **Given** a KPI has a score that requires evidence under the assigned rubric rules
  - **When** the assessor attempts to submit without the required evidence
  - **Then** submission is prevented
  - **And** the relevant KPI has understandable validation feedback.

### Observation visibility

- **AC-004 — Draft is hidden from subject staff everywhere**
  - **Given** a manager has created a draft observation for staff member A
  - **When** staff member A opens observations, dashboard/action views, searches observation records, or requests the observation directly
  - **Then** the draft is not listed or counted
  - **And** direct access does not disclose its metadata, rubric, progress, answers, evidence, or activity.

- **AC-005 — Submitted record becomes available for acknowledgment**
  - **Given** an observation for staff member A is submitted by an authorized manager
  - **When** staff member A opens their observations
  - **Then** the submitted observation is available as a read-only record with an acknowledgment action
  - **And** A cannot change the observation’s scores, evidence, answers, or manager feedback.

- **AC-006 — Reopened record becomes private again**
  - **Given** staff member A can view a submitted or acknowledged observation
  - **When** an administrator reopens the observation
  - **Then** A can no longer list or access the observation until it is submitted again
  - **And** the assigned manager and authorized oversight roles retain access.

- **AC-007 — Mixed-role account does not bypass staff privacy unintentionally**
  - **Given** the observation subject also has another application role
  - **When** they are not the assigned manager, administrator, or director for that observation
  - **Then** their subject-staff relationship alone does not grant draft access.

### Dialog

- **AC-008 — Long active-appraisal details do not overflow**
  - **Given** an active-appraisal dialog whose staff and rubric names are long
  - **When** it is viewed at desktop width, a narrow mobile viewport, and 200% zoom
  - **Then** the full dialog message and all eligible actions are visible and usable
  - **And** actions reflow or the dialog scrolls safely rather than extending outside the panel.

- **AC-009 — Draft-only destructive choice**
  - **Given** the matching active appraisal is a draft
  - **When** the confirmation dialog opens
  - **Then** cancel, continue, and discard-and-create-new are available.
  - **Given** the matching appraisal is not a draft
  - **When** the confirmation dialog opens
  - **Then** discard-and-create-new is not offered.

### Department administration

- **AC-010 — Find and inspect a department**
  - **Given** a multi-level department hierarchy
  - **When** an administrator searches for a nested department
  - **Then** the interface reveals and selects that department
  - **And** shows its ancestry, immediate children, and manager/staff summary.

- **AC-011 — Manage a departmental assignment in context**
  - **Given** an administrator is viewing a department detail
  - **When** they choose to manage its manager or staff assignment
  - **Then** the existing role/member management flow opens scoped to that department and role
  - **And** returning to the structure retains the department context.

- **AC-012 — Keyboard and responsive hierarchy operation**
  - **Given** an administrator uses only a keyboard or a narrow viewport
  - **When** they navigate a department branch and open its management actions
  - **Then** expand/collapse, selection, and actions have accessible names, visible focus, and remain operable without horizontal-page overflow.

## 7. Non-functional Requirements

- **NFR-001:** All changed UI states must meet WCAG 2.1 AA contrast, have semantic accessible names, preserve visible focus, and be keyboard operable.
- **NFR-002:** The revised self-assessment, dialog, department view, and affected observation states must remain usable at mobile widths, desktop widths, and 200% zoom in light and dark themes.
- **NFR-003:** Privacy must be evaluated at the server authorization boundary. A staff user must not obtain in-progress observation data by modifying URLs, request parameters, cached UI state, or a direct API request.
- **NFR-004:** No change may alter stored self-assessment scores, evidence, appraisal records, observation answers, observation activity history, department hierarchy, or existing assignment data solely to achieve the UI changes.
- **NFR-005:** The revised workflows must not add interaction-blocking animation or materially degrade the initial rendering or input responsiveness of the self-assessment and administration pages.

## 8. Scope Boundaries

### In scope

- Self-assessment presentation and interaction changes needed to expose all KPIs by default.
- Observation staff-subject visibility enforcement before and after finalization for acknowledgment.
- Responsive/accessibility correction of the active-appraisal confirmation dialog.
- Department Structure UI redesign within the existing Administration area, including hierarchy navigation, discoverability, contextual assignment management, and clear manager/staff representation.

### Out of scope

- Changes to self-assessment scoring, evidence storage, rubric configuration, workflow assignment, or appraisal lifecycle.
- Changes to manager-led staff-appraisal lifecycle or permissions beyond the dialog presentation.
- A new observation state, new observation approval step, or a new staff observation editor.
- New organizational data fields, automatic reporting-line inference, bulk imports, or redesign of the User Management and Workflow tabs.
- Changes to the authority of director/admin roles or to existing deletion business rules.

## 9. Assumptions and Dependencies

### Assumptions

1. `submitted` is the product’s finalized-for-acknowledgment observation state because it is the current state required for staff acknowledgment.
2. “Ongoing” includes an observation that is draft or reopened into an editable/in-progress state; staff subjects should not learn that it exists during those states.
3. “Similar to the staff appraisal” refers to a simplified, dense, always-accessible review form and action layout—not a change to the self-assessment model or replacement of its KPI/evidence controls.
4. Department managers and staff are represented by the existing departmental role assignments; a person may have more than one role where current authorization permits it.

### Dependencies

- The manager-led staff-appraisal lifecycle and status definitions in `docs/specs/manager-led-staff-appraisals.md`.
- Existing authentication, authorization, observation lifecycle, notification, rubric, department, user, and departmental role-assignment capabilities.
- ProofPoint semantic design-token and accessibility requirements in `.specify/memory/constitution.md`.

## 10. Success Criteria

- **SC-001:** In usability verification, a self-assessor can reach any KPI’s score and evidence controls with no expand action required.
- **SC-002:** Automated authorization coverage demonstrates that a staff subject receives no observation list, summary, detail, answer, or activity data for draft/reopened observations, and receives acknowledgment-only access after submission.
- **SC-003:** The active-appraisal dialog has no clipped or unreachable text/actions at defined mobile/desktop viewports and 200% zoom.
- **SC-004:** In a representative multi-level organization, an administrator can find a nested department and open a relevant role-assignment action without manually expanding unrelated department branches.
- **SC-005:** Build, lint, accessibility/keyboard checks, and affected responsive light/dark-theme validation pass under the repository quality standards.

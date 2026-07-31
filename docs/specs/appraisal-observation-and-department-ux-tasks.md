# Appraisal, Observation, and Department Administration UX — Tasks

**Specification:** `docs/specs/appraisal-observation-and-department-ux.md`  
**Plan:** `docs/specs/appraisal-observation-and-department-ux-plan.md`  
**Last updated:** 2026-07-31

## Phase 1 — Foundations

- [x] **T-001** Read the specification, constitution, affected routes/components, and current working tree.
- [x] **T-002** Confirm no schema migration or new dependency is required.
- [x] **T-003** Identify the existing database-backed observation integration harness and authenticated route test actor.

## Phase 2 — Self-assessment presentation

- [x] **T-101** Add always-expanded section/KPI presentation without changing assessment data behavior.  
  Coverage: FR-002–FR-007, AC-001–AC-003.
- [x] **T-102** Render the assessment page with all KPI controls in normal reading order.  
  Coverage: SC-001 implementation.
- [x] **T-103** Preserve score/evidence/save/submit behavior and remove focused assessment-page lint warnings.
- [ ] **T-104** Validate editable and read-only multi-domain self-assessments in an authenticated browser at desktop, mobile, 200% zoom, keyboard-only, light, and dark themes.  
  Blocked: the browser matrix below confirms that no current working-tree server is available at `http://localhost:3000`; `http://localhost:3060` is the published `ghcr.io/faisalnh/proofpoint-dashboard:latest` container image, not this checkout; no browser-test credentials are documented.

## Phase 3 — Observation confidentiality

- [x] **T-201** Enforce staff-subject draft/reopened privacy in shared observation permissions.  
  Coverage: FR-008–FR-012.
- [x] **T-202** Apply staff visibility filtering to list rows, filtered totals, summary counts, search, attention/recent data, and pagination.  
  Coverage: FR-009, FR-013, AC-004, AC-006.
- [x] **T-203** Remove staff-facing reopen notification disclosure.  
  Coverage: FR-011, FR-014.
- [x] **T-204** Add database-backed query coverage proving draft records are absent from subject list/search/count/summary/pagination data.  
  Coverage: AC-004, SC-002.
- [x] **T-205** Add authenticated route coverage proving draft/reopened detail requests return no observation payload and staff answer writes are denied.  
  Coverage: FR-008–FR-009, AC-004, AC-006, NFR-003, SC-002.
- [x] **T-206** Add authenticated lifecycle coverage proving submitted records are read-only, visible, and acknowledgeable by the subject.  
  Coverage: FR-010, AC-005, SC-002.
- [x] **T-207** Add authenticated privileged-role coverage for assigned manager, director subject with independent privilege, and administrator behavior.  
  Coverage: FR-012, AC-007.
- [ ] **T-208** Validate staff draft/reopened direct URL denial and submitted acknowledgment through the current working-tree browser build.  
  Blocked by the browser environment constraints recorded under T-104. Automated route-boundary coverage passes.

## Phase 4 — Active-appraisal dialog

- [x] **T-301** Constrain dialog width/height and enable safe vertical overflow.
- [x] **T-302** Wrap long staff/rubric text and reflow actions at narrow widths.
- [x] **T-303** Preserve keyboard-focusable actions, destructive semantics, and duplicate-request disabling.  
  Coverage: FR-015–FR-019, AC-008–AC-009 implementation.
- [ ] **T-304** Validate long-name draft and non-draft dialogs at desktop, narrow mobile, 200% zoom, keyboard-only, light, and dark themes.  
  Blocked by the browser environment constraints recorded under T-104.

## Phase 5 — Department Structure

- [x] **T-401** Implement searchable hierarchy navigation and focused department details.  
  Coverage: FR-020–FR-024, AC-010.
- [x] **T-402** Reuse existing edit/delete and department role/member management workflows.  
  Coverage: FR-025–FR-028, AC-011.
- [x] **T-403** Remove the incomplete `role="tree"` declaration and retain standard semantic buttons/tab navigation.  
  Coverage: NFR-001, AC-012.
- [ ] **T-404** Validate nested search/reveal, empty/single/multiple-root/deep hierarchies, management-dialog return context, keyboard, mobile, 200% zoom, light, and dark themes.  
  Blocked by the browser environment constraints recorded under T-104.

## Phase 6 — Automated validation

- [x] **T-501** Run database-backed observation integration tests.  
  Command: `NODE_ENV=test node --env-file=.env.local --import tsx --test src/features/observations/server/observation-api.integration-test.ts`  
  Result: 3 tests passed, 0 failed.
- [x] **T-502** Run TypeScript validation.  
  Command: `npx tsc --noEmit`  
  Result: passed.
- [x] **T-503** Run focused lint on affected feature files.  
  Command: `npx eslint src/components/admin/DepartmentStructure.tsx src/app/assessment/page.tsx src/app/manager/new/page.tsx src/features/observations/server/observation-api.integration-test.ts src/features/observations/server/observation-domain.test.ts src/features/observations/server/permissions.ts src/features/observations/server/queries.ts`  
  Result: passed with 0 errors and 0 warnings.
- [x] **T-504** Run production build.  
  Command: `npm run build`  
  Result: passed; unrelated pre-existing repository warnings remain.
- [x] **T-505** Persist plan and task artifacts with truthful completion state.
- [ ] **T-506** Execute the constitution-mandated authenticated browser validation matrix.  
  Matrix recorded below; every scenario remains blocked pending a current working-tree build, representative test data, and authenticated test accounts. Direct recorded evidence is required before changing the specification lifecycle to validation complete/approved.

## Authenticated browser validation matrix

**Recorded:** 2026-07-31  
**Execution standard:** Every passing entry must be exercised against the current working-tree build with the stated authenticated actor and fixture data. A published image, an unauthenticated route, or automated route-test output is not browser-validation evidence.  
**Environment probe:** `curl -I http://localhost:3000` failed to connect; `docker ps` identified `http://localhost:3060` as `ghcr.io/faisalnh/proofpoint-dashboard:latest`, so it is explicitly excluded. No documented browser-test credentials or representative browser fixtures are available.

| ID | Authenticated actor and fixture | Viewport / zoom | Theme | Keyboard path | Expected outcome | Result / defect |
| --- | --- | --- | --- | --- | --- | --- |
| BM-01 | Staff/self-assessor; editable multi-domain assessment with saved values and an evidence-required KPI | Desktop, 1440×900 / 100% | Light | Tab through all KPI score/evidence controls; save; attempt submit without required evidence | All KPI controls are in ordinary reading order; saved data remains intact; missing evidence blocks submission with clear feedback | **Blocked** — current working-tree server, authenticated staff account, and fixture unavailable. |
| BM-02 | Staff/self-assessor; editable multi-domain assessment | Mobile, 390×844 / 100% | Dark | Tab through KPI controls and actions | No forced expansion or horizontal-page overflow; controls/actions remain usable with visible focus | **Blocked** — current working-tree server, authenticated staff account, and fixture unavailable. |
| BM-03 | Staff/self-assessor; editable multi-domain assessment | Desktop, 1440×900 / 200% | Light | Keyboard reachability through all KPI controls | All KPI controls remain reachable by scroll and keyboard without clipped content | **Blocked** — current working-tree server, authenticated staff account, and fixture unavailable. |
| BM-04 | Staff/reviewer; read-only multi-domain assessment | Desktop, 1440×900 / 100% | Dark | Tab through applicable links/actions | All applicable KPI data is readable without forced expansion; no edit controls are exposed | **Blocked** — current working-tree server, authenticated account, and read-only fixture unavailable. |
| BM-05 | Observation subject; own draft and reopened observation direct URLs and observation surfaces | Desktop, 1440×900 / 100% | Light | Navigate observations, search, use stale/direct detail URLs, and tab through page actions | No list/count/search/detail/activity/answer disclosure for draft or reopened observations | **Blocked** — current working-tree server, authenticated subject account, and lifecycle fixtures unavailable. Automated route-boundary coverage passed but does not satisfy this browser check. |
| BM-06 | Observation subject; own submitted observation | Mobile, 390×844 / 100% | Dark | Open record; tab to and activate acknowledgment | Finalized record is read-only, acknowledgment is available and usable, and editing controls remain unavailable | **Blocked** — current working-tree server, authenticated subject account, and submitted fixture unavailable. |
| BM-07 | Manager/administrator; long-name active draft appraisal conflict | Desktop, 1440×900 / 100% | Light | Open dialog; tab/shift-tab among cancel, continue, and discard-and-create; activate cancel | Staff, period, rubric, and all actions are visible; focus is visible; destructive action is distinct | **Blocked** — current working-tree server, authenticated privileged account, and long-name draft fixture unavailable. |
| BM-08 | Manager/administrator; long-name active draft appraisal conflict | Mobile, 390×844 / 100% | Dark | Tab through and activate each dialog action | Dialog text/actions wrap, reflow, or scroll within its panel and viewport without horizontal clipping | **Blocked** — current working-tree server, authenticated privileged account, and long-name draft fixture unavailable. |
| BM-09 | Manager/administrator; long-name non-draft appraisal conflict | Desktop, 1440×900 / 200% | Light | Open dialog and traverse actions using keyboard only | Dialog remains readable/operable; discard-and-create is absent; no text/action is clipped or unreachable | **Blocked** — current working-tree server, authenticated privileged account, and long-name non-draft fixture unavailable. |
| BM-10 | Administrator; empty organization and single-root organization | Desktop, 1440×900 / 100% | Light | Tab to hierarchy controls and focused actions | Empty and single-root states are clear and operable without an ambiguous/broken hierarchy | **Blocked** — current working-tree server, authenticated administrator account, and fixtures unavailable. |
| BM-11 | Administrator; multiple roots and deep nested hierarchy with manager/staff/empty assignments | Desktop, 1440×900 / 100% | Dark | Search nested department; keyboard expand/select branch; open detail | Search reveals and selects the match; ancestry, immediate children, and role-distinguished people summary are clear | **Blocked** — current working-tree server, authenticated administrator account, and hierarchy fixture unavailable. |
| BM-12 | Administrator; selected nested department with departmental manager/staff assignments | Mobile, 390×844 / 100% | Light | Keyboard expand/select; open role/member management; return/close dialog | Actions have accessible names and visible focus, no horizontal-page overflow occurs, and selected department context persists after return | **Blocked** — current working-tree server, authenticated administrator account, and hierarchy/assignment fixture unavailable. |
| BM-13 | Administrator; deeply nested hierarchy | Desktop, 1440×900 / 200% | Dark | Keyboard navigation through branches and management actions | Branch controls, selection, and actions remain visible and operable without clipping or horizontal-page overflow | **Blocked** — current working-tree server, authenticated administrator account, and deep-hierarchy fixture unavailable. |

**Exit criteria:** Re-run every blocked row against a locally started current working-tree build, record the actual build/commit identifier, account role, fixture identifier, viewport, zoom, theme, keyboard path, outcome, and any defect. Only then mark T-104, T-208, T-304, T-404, and T-506 complete and update the specification/plan status.

## Current completion summary

- Code and automated security coverage: complete.
- ARIA semantics correction: complete.
- Plan/task traceability: complete.
- Build/type/integration validation: complete.
- Focused lint: complete with 0 errors and 0 warnings.
- Authenticated responsive/accessibility/theme validation: blocked and incomplete.
- Specification lifecycle: implementation complete; validation pending.
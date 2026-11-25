# Graph Report - mws-proofpoint  (2026-11-23)

## Corpus Check
- 371 files · ~242,266 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 1, .prisma 1)

## Summary
- 2478 nodes · 6756 edges · 120 communities (106 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6f689042`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- director/page.tsx
- ApiClient
- dependencies
- lucide-react
- ObservationRubricPreviewDialog.tsx
- components/ObservationFormEditor.tsx
- next
- admin/page.tsx
- users/route.ts
- observations/types.ts
- useAuth
- auth
- Global Observation Notification Settings — Development Plan
- cn
- Multi-Teacher Observations — Development Plan
- package.json
- ObservationDetailReport.tsx
- central-sync.ts
- submit/route.ts
- [indicatorId]/route.ts
- assessment/index.ts
- ObservationList.tsx
- queryOne
- sidebar.tsx
- [id]/route.ts
- strategic-plans.ts
- notification-settings/page.tsx
- pg
- isHubAuthEnabled
- role-workflow-assignments/route.ts
- observationAcknowledgementScheduler.ts
- ObservationListPage.tsx
- observation-api.integration-test.ts
- central-structure-sync.ts
- StrategicPlansClient.tsx
- react
- providers.tsx
- action/route.ts
- notificationSettings.ts
- ObservationCreationWizard
- central-access.ts
- scripts
- server/queries.ts
- notifications/index.ts
- Rencana: Semua Akses ProofPoint Diatur dari Central
- ProofPoint
- Production Database Migration Runbook
- Strategic Planning Module — Spec
- workflow-definitions/route.ts
- compilerOptions
- Appraisal, Observation, and Department Administration UX — Specification
- rubric-preview-utils.ts
- hub-auth.ts
- ref_node_assert
- email/index.ts
- observation-notifications.ts
- components.json
- devDependencies
- StrategicPlansClient
- [id]/evidence/route.ts
- api/assessments/route.ts
- storage.ts
- carousel.tsx
- observations/route.ts
- rubric-authorization.ts
- Required rollout sequence
- run-observation-integration-tests.mjs
- central-access.test.ts
- form.tsx
- preferences.ts
- hooks/use-toast.ts
- processAcknowledgementAutomation.ts
- Multi-teacher observations rollout
- toast.tsx
- effective-user-access.ts
- Procedure
- 3. Implementation increments
- observation-performance-check.ts
- chart.tsx
- available-forms/route.ts
- prisma.ts
- context-menu.tsx
- ProofPoint Engineering Constitution
- deploy.sh
- Appraisal, Observation, and Department Administration UX — Tasks
- pagination.tsx
- Observation acknowledgement automation
- eslint.config.mjs
- prisma-client.ts
- navigation-menu.tsx
- breadcrumb.tsx
- drawer.tsx
- guardedMutation
- flattenPrograms
- Department Membership Source of Truth Rollout
- seed-it-support-staff-appraisal.ts
- assessmentStatus.ts
- What the application supports today
- input-otp.tsx
- sheet.tsx
- 4. User Stories
- 6. Acceptance Scenarios
- avatar.tsx
- icon.tsx
- ObservationSummaryCards.tsx
- scroll-area.tsx
- resizable.tsx
- tailwind.config.ts
- KpiRubricsContent.tsx
- hover-card.tsx
- slider.tsx
- NewStaffAppraisal
- generateAppraisalPdf.ts
- entrypoint.sh
- start.sh
- postcss.config.js
- pre-20260812-baseline/README.md
- quick-deploy.sh
- { handlers, signIn, signOut }

## God Nodes (most connected - your core abstractions)
1. `cn()` - 275 edges
2. `next` - 103 edges
3. `auth()` - 103 edges
4. `react` - 102 edges
5. `query()` - 97 edges
6. `queryOne()` - 94 edges
7. `lucide-react` - 77 edges
8. `ApiClient` - 69 edges
9. `Button` - 53 edges
10. `useAuth()` - 38 edges

## Surprising Connections (you probably didn't know these)
- `2. Architecture and constraints` --references--> `getObservationPermissions()`  [INFERRED]
  docs/specs/appraisal-observation-and-department-ux-plan.md → src/features/observations/server/permissions.ts
- `Increment B — Observation confidentiality` --references--> `getObservationPermissions()`  [INFERRED]
  docs/specs/appraisal-observation-and-department-ux-plan.md → src/features/observations/server/permissions.ts
- `Fase 2: ProofPoint, sync struktur dari Central` --references--> `rolesWithinLocalDepartmentScope()`  [INFERRED]
  docs/Plan/central-managed-access.md → src/lib/central-access.ts
- `Task 2: KPI / Staff Appraisal Interactive Preview Dialog & Editor Wiring` --references--> `RubricsContent()`  [INFERRED]
  docs/superpowers/plans/2026-11-04-rubric-preview.md → src/app/rubrics/page.tsx
- `Goals` --references--> `AssessmentIndicator()`  [INFERRED]
  docs/superpowers/specs/2026-11-04-rubric-preview-design.md → src/components/assessment/AssessmentIndicator.tsx

## Import Cycles
- None detected.

## Communities (120 total, 14 thin omitted)

### Community 0 - "director/page.tsx"
Cohesion: 0.07
Nodes (46): WorkflowStep, StaffAssignment, Domain, KPI, RubricsContent(), Standard, Template, Indicator (+38 more)

### Community 2 - "dependencies"
Cohesion: 0.03
Nodes (63): dependencies, @auth/pg-adapter, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, bcrypt, class-variance-authority, clsx, cmdk (+55 more)

### Community 3 - "lucide-react"
Cohesion: 0.08
Nodes (45): lucide-react, AuditChange, AuditEntry, AuditResponse, displayValue(), LABELS, ObservationNotificationSettingsAuditHistory(), TIMING_FIELDS (+37 more)

### Community 4 - "ObservationRubricPreviewDialog.tsx"
Cohesion: 0.07
Nodes (40): Assessment, UserProfile, NotificationPreferences, DepartmentRoleAssignment, DepartmentStructure(), DepartmentStructureDepartment, DepartmentStructureProps, DepartmentStructureRoleHolder (+32 more)

### Community 5 - "components/ObservationFormEditor.tsx"
Cohesion: 0.08
Nodes (33): @radix-ui/react-dialog, sonner, @tanstack/react-query, AssessmentProgressProps, Command, CommandDialogProps, CommandEmpty, CommandGroup (+25 more)

### Community 6 - "next"
Cohesion: 0.11
Nodes (31): nextConfig, ref_crypto, next, POST(), DELETE(), PATCH(), POST(), DELETE() (+23 more)

### Community 7 - "admin/page.tsx"
Cohesion: 0.07
Nodes (39): AdminContent(), Department, OrganizationAssignment, RoleHolder, User, Auth(), loginSchema, signupSchema (+31 more)

### Community 8 - "users/route.ts"
Cohesion: 0.09
Nodes (43): AssignmentRow, GET(), PUT(), requireAdmin(), serializeAssignments(), DELETE(), POST(), PUT() (+35 more)

### Community 9 - "observations/types.ts"
Cohesion: 0.06
Nodes (46): CreateObservationRequestInput, ObservationFilterOptions, saveObservationAnswer(), ObservationFiltersProps, ObservationItemSaveState, ObservationItemSaveStatus, savedState, useObservationSaveState() (+38 more)

### Community 10 - "useAuth"
Cohesion: 0.07
Nodes (39): date-fns, PerformanceAppraisalsContent(), AssessmentContent(), DashboardContent(), DirectorContent(), ManagerContent(), features, Home() (+31 more)

### Community 11 - "auth"
Cohesion: 0.10
Nodes (34): DELETE(), GET(), POST(), PUT(), requireAdmin(), AssessmentActionBody, GET(), PUT() (+26 more)

### Community 12 - "Global Observation Notification Settings — Development Plan"
Cohesion: 0.04
Nodes (46): 10. Backward compatibility, 11.1 Unit tests, 11.2 API integration tests, 11.3 Automation integration tests, 11.4 Email tests, 11.5 Browser validation, 11. Testing plan, 12. Observability and operations (+38 more)

### Community 13 - "cn"
Cohesion: 0.06
Nodes (43): @radix-ui/react-dropdown-menu, @radix-ui/react-menubar, @radix-ui/react-radio-group, IndicatorEditDialog(), AlertDialogOverlay, CardFooter, CommandSeparator, CommandShortcut() (+35 more)

### Community 14 - "Multi-Teacher Observations — Development Plan"
Cohesion: 0.05
Nodes (44): 10. Delivery increments, 11.1 Migration tests, 11.2 API and domain tests, 11.3 Query and reporting tests, 11.4 Browser validation, 11. Testing and validation, 12. Operational and rollout considerations, 13. Acceptance criteria (+36 more)

### Community 15 - "package.json"
Cohesion: 0.05
Nodes (40): license, name, private, type, version, @auth/pg-adapter, autoprefixer, clsx (+32 more)

### Community 16 - "ObservationDetailReport.tsx"
Cohesion: 0.08
Nodes (29): acknowledgeObservation(), deleteObservation(), patchObservationTransition(), reopenObservation(), submitObservation(), actionContent, ActivityReport(), activityTitle() (+21 more)

### Community 17 - "central-sync.ts"
Cohesion: 0.09
Nodes (34): GET(), POST(), register(), CentralDirectoryEmployee, CENTRAL_SYNC_ADVISORY_LOCK, centralManagesDepartments(), CentralStructureStatus, CentralSyncAction (+26 more)

### Community 18 - "submit/route.ts"
Cohesion: 0.10
Nodes (33): 6.3 Permissions and confidentiality, accessRecord(), AcknowledgementMethod, AcknowledgementResult, AcknowledgeObservationRow, AdminEmailRow, LockedObservationRow, LockedParticipantRow (+25 more)

### Community 19 - "[indicatorId]/route.ts"
Cohesion: 0.10
Nodes (34): Task 3: Observation Form Interactive Preview Dialog & Editor Wiring, Approaches Considered, Architecture & Interfaces, Goals, Intent & Why, Non-Goals & Anti-Goals, Rubric Fill-In Preview Design Spec, answerColumns() (+26 more)

### Community 20 - "assessment/index.ts"
Cohesion: 0.10
Nodes (31): @radix-ui/react-accordion, AssessmentIndicator(), hasEvidence(), KPIData, AssessmentSection(), AssessmentSectionProps, calculateDomainScore(), DomainData (+23 more)

### Community 21 - "ObservationList.tsx"
Cohesion: 0.18
Nodes (27): fetchObservationSummary(), ObservationCard(), ObservationDetailReport(), ObservationLifecycle(), ObservedTeachers(), personName(), SaveSummary(), ObservationList() (+19 more)

### Community 22 - "queryOne"
Cohesion: 0.14
Nodes (29): GET(), accessError(), DELETE(), PATCH(), POST(), accessError(), DELETE(), PATCH() (+21 more)

### Community 23 - "sidebar.tsx"
Cohesion: 0.07
Nodes (30): Separator, Sidebar, SidebarContent, SidebarContext, SidebarContextValue, SidebarFooter, SidebarGroup, SidebarGroupAction (+22 more)

### Community 24 - "[id]/route.ts"
Cohesion: 0.11
Nodes (31): ObservationRow, aggregateObservationStatus(), AnswerRow, AuditRow, DELETE(), GET(), hasIndicator(), isRequestObject() (+23 more)

### Community 25 - "strategic-plans.ts"
Cohesion: 0.17
Nodes (25): 9. API (Next.js Route Handlers), GET(), DELETE(), GET(), Params, PATCH(), sessionUser(), GET() (+17 more)

### Community 26 - "notification-settings/page.tsx"
Cohesion: 0.12
Nodes (19): formatDate(), ObservationSchedulerStatusCard(), SchedulerStatus, DEFAULT_SETTINGS, FORM_KEYS, getApiError(), NotificationSettingsContent(), NumericSettingKey (+11 more)

### Community 27 - "pg"
Cohesion: 0.10
Nodes (12): pool, @aws-sdk/client-s3, dotenv, pg, uuid, s3Client, pool, pool (+4 more)

### Community 28 - "isHubAuthEnabled"
Cohesion: 0.16
Nodes (17): bcrypt, GET(), GET(), POST(), PUT(), POST(), SignupBody, PUT() (+9 more)

### Community 29 - "role-workflow-assignments/route.ts"
Cohesion: 0.10
Nodes (24): zod, GET(), historyQuerySchema, AssignmentRow, CreateAssignmentBody, CreatedAssignmentRow, DELETE(), ExistingAssignmentRow (+16 more)

### Community 30 - "observationAcknowledgementScheduler.ts"
Cohesion: 0.13
Nodes (24): GET(), DEFAULT_OBSERVATION_SCHEDULER_INTERVAL_MINUTES, getObservationSchedulerIntervalMs(), AutomationProcessor, getObservationSchedulerConfig(), OBSERVATION_SCHEDULER_ADVISORY_LOCK, ObservationSchedulerConfig, ObservationSchedulerRunOptions (+16 more)

### Community 31 - "ObservationListPage.tsx"
Cohesion: 0.13
Nodes (15): ObservationEditPage(), ObservationDetailPage(), Skeleton(), fetchObservationDetail(), fetchObservationFilterOptions(), fetchObservationList(), getJson(), observationListSearchParams() (+7 more)

### Community 32 - "observation-api.integration-test.ts"
Cohesion: 0.11
Nodes (16): GET(), getObservationSession(), setObservationTestActor(), AUTOMATION_SETTINGS, cleanupFixture(), cleanupWorkflowFixture(), countsKeys, Fixture (+8 more)

### Community 33 - "central-structure-sync.ts"
Cohesion: 0.12
Nodes (20): CentralDirectoryEntitlement, CentralOrganizationUnit, rolesFromCentralEntitlement(), centralStructureInput(), CentralStructureStore, DEPARTMENTAL_ROLES, describeStructurePlan(), normalize() (+12 more)

### Community 34 - "StrategicPlansClient.tsx"
Cohesion: 0.09
Nodes (8): DocumentBuilder(), findParent(), findSelected(), FocusedEditor(), Mode, programStatuses, SelectedItem, statusLabel

### Community 35 - "react"
Cohesion: 0.14
Nodes (16): class-variance-authority, react, AssessmentIndicatorProps, EvidenceInput(), EvidenceInputProps, hasMinimumEvidence(), isEvidenceRequired(), parseEvidenceValue() (+8 more)

### Community 36 - "providers.tsx"
Cohesion: 0.09
Nodes (19): next-auth, next-themes, src_app_globals, jetbrainsMono, metadata, nunitoSans, plusJakartaSans, Providers() (+11 more)

### Community 37 - "action/route.ts"
Cohesion: 0.16
Nodes (18): ratings, score, actions, isValidRating(), PATCH(), calculateWeightedPercentageScore(), getGradeFromScore(), Rating (+10 more)

### Community 38 - "notificationSettings.ts"
Cohesion: 0.12
Nodes (21): createObservationNotificationSettingsHandlers(), ObservationNotificationSettingsRouteDependencies, GET, PUT, DEFAULT_UPDATE_SETTINGS, ensureSingletonRow(), EventSettingKey, getObservationNotificationSettings() (+13 more)

### Community 39 - "ObservationCreationWizard"
Cohesion: 0.10
Nodes (20): Authorization, Configuration, Data retention and compatibility, Endpoints, Manager-led staff appraisals, Purpose, Staff appraisal lifecycle, Staff appraisal rubric mode (+12 more)

### Community 40 - "central-access.ts"
Cohesion: 0.29
Nodes (20): cache, cacheDurationMs(), CentralUnavailableError, employeeCache, getCentralDirectoryKey(), getCentralEntitlementKey(), getCentralOrganizationUnitKey(), listActiveCentralEmployees() (+12 more)

### Community 41 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, db:generate, db:migrate:check, db:migrate:deploy, db:migrate:dev, db:migrate:rebaseline, db:migrate:reset (+14 more)

### Community 42 - "server/queries.ts"
Cohesion: 0.18
Nodes (20): ParticipantRow, OBSERVATION_ATTENTION_LIMIT, OBSERVATION_RECENT_LIMIT, OBSERVATION_STALE_DAYS, actionExpressionNeedsActor(), buildActionRequiredExpression(), buildListFilters(), buildVisibilityClause() (+12 more)

### Community 43 - "notifications/index.ts"
Cohesion: 0.19
Nodes (17): getAssessmentNotificationData(), generateEmailContent(), getAdminUsers(), getRecipientsForNotificationType(), SendNotificationParams, sendNotificationToRecipient(), triggerNotification(), createNotificationLog() (+9 more)

### Community 44 - "Rencana: Semua Akses ProofPoint Diatur dari Central"
Cohesion: 0.10
Nodes (20): Aturan membership yang dipakai, Checklist uji, Departemen ProofPoint dibandingkan dengan unit Central, Fase 1: Central (`mws-central-database-user`), Fase 2: ProofPoint, sync struktur dari Central, Fase 3: ProofPoint, admin hanya-baca (mode Hub), Fase 4: Migrasi data lama dan rollout, Hasil cek DB prod (2026-11-19) (+12 more)

### Community 45 - "ProofPoint"
Cohesion: 0.10
Nodes (21): Appraisal workflows, Branch and image mapping, Current application status, Database and migration policy, Delivery flow, Deployment, Deployment verification, Documentation (+13 more)

### Community 46 - "Production Database Migration Runbook"
Cohesion: 0.10
Nodes (20): 1. Schedule downtime, 2. Back up production, 3. Deploy code and schema, 4. Verify the empty/new schema shape, 5. Restore data manually, 6. Validate migrated data, 7. Smoke test, 8. Re-enable production (+12 more)

### Community 47 - "Strategic Planning Module — Spec"
Cohesion: 0.11
Nodes (19): 10. Lifecycle Rules, 11. Visibility and Authorization Rules (concrete), 12. Status Semantics, 13. Validation Rules, 14. Evidence Upload Rules, 15. Audit / History Scope, 16. Acceptance Criteria, 17. Phased Delivery (+11 more)

### Community 48 - "workflow-definitions/route.ts"
Cohesion: 0.14
Nodes (18): AssignmentRow, DELETE(), ExistingWorkflowRow, FormattedWorkflowStep, GET(), POST(), PUT(), requireAdmin() (+10 more)

### Community 49 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 50 - "Appraisal, Observation, and Department Administration UX — Specification"
Cohesion: 0.11
Nodes (17): 10. Success Criteria, 1. Purpose, 2. Existing Product Constraints, 3. Actors, 5. Functional Requirements, 7. Non-functional Requirements, 8. Scope Boundaries, 9. Assumptions and Dependencies (+9 more)

### Community 51 - "rubric-preview-utils.ts"
Cohesion: 0.19
Nodes (15): Global Constraints, Review Focus, Rubric Fill-In Preview Implementation Plan, Task 1: Pure Preview State Normalization Helpers & Unit Tests, Task 2: KPI / Staff Appraisal Interactive Preview Dialog & Editor Wiring, KpiRubricPreviewDialog(), KpiRubricPreviewDialogProps, ObservationRubricPreviewDialogProps (+7 more)

### Community 52 - "hub-auth.ts"
Cohesion: 0.14
Nodes (16): mws-central-auth, CentralEmployeeProfile, CentralEntitlement, UNSCOPED_ROLES, defaultDependencies, HubAuthDependencies, LocalMembership, LocalUser (+8 more)

### Community 53 - "ref_node_assert"
Cohesion: 0.15
Nodes (10): ref_node_assert, ref_node_test, validUpdate, managerLed, DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS, OBSERVATION_NOTIFICATION_EVENT_POLICY, validUpdate, ActiveAuthUser (+2 more)

### Community 54 - "email/index.ts"
Cohesion: 0.20
Nodes (12): nodemailer, createEmailClient(), isValidEmail(), sendEmail(), validateAndNormalizeEmails(), EmailConfig, emailSubjects, emailTemplates (+4 more)

### Community 55 - "observation-notifications.ts"
Cohesion: 0.30
Nodes (15): isObservationNotificationEventEnabled(), ObservationNotificationEvent, src_lib_email_index_emailresult, esc(), notifyManagerObservationAcknowledged(), notifyManagerObservationReopened(), notifyObservationAcknowledged(), notifyObservationAcknowledgementReminder() (+7 more)

### Community 56 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 57 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, eslint, eslint-config-next, @eslint/eslintrc, postcss, tailwindcss, @tailwindcss/typography (+9 more)

### Community 59 - "[id]/evidence/route.ts"
Cohesion: 0.23
Nodes (14): AssessmentEvidenceRow, collectEvidenceUrls(), GET(), getObjectKey(), sanitizeFileName(), actorFromSession(), AssessmentAccessRow, GET() (+6 more)

### Community 60 - "api/assessments/route.ts"
Cohesion: 0.19
Nodes (14): asScoreMap(), AssessmentKpiWeight, AssessmentListRow, calculateLegacyAssessmentScore(), GET(), getNotificationTypeForStatus(), hasEvidence(), hydrateCalculatedScores() (+6 more)

### Community 61 - "storage.ts"
Cohesion: 0.20
Nodes (9): @aws-sdk/s3-request-presigner, POST(), safeFilename(), POST(), ensureBucketExists(), s3Client, uploadFile(), uploadFileWithKey() (+1 more)

### Community 62 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+6 more)

### Community 63 - "observations/route.ts"
Cohesion: 0.21
Nodes (14): CreateObservationRequest, GET(), isRequestObject(), ObservationScopeType, optionalText(), parseDate(), parseScope(), parseStaffIds() (+6 more)

### Community 64 - "rubric-authorization.ts"
Cohesion: 0.27
Nodes (12): DELETE(), GET(), PATCH(), POST(), authorRoles, canCreateRubric(), canDeleteRubric(), canManageRubric() (+4 more)

### Community 65 - "Required rollout sequence"
Cohesion: 0.14
Nodes (14): 1. Schedule a maintenance window, 2. Back up and verify PostgreSQL, 3. Capture existing migration records, 4. Run the guarded rebaseline command, 5. Apply forward migrations, 6. Verify migration status, 7. Validate the application, Fresh database verification (+6 more)

### Community 66 - "run-observation-integration-tests.mjs"
Cohesion: 0.15
Nodes (10): ref_node_child_process, allowedIdTypes, applyWorkflowDefinitionsMigration(), getColumnType(), pool, adminClient, adminUrl, childEnvironment (+2 more)

### Community 67 - "central-access.test.ts"
Cohesion: 0.26
Nodes (12): ref_node_fs, ref_node_url, centralRequest(), check(), comparePermissions(), configuration(), main(), permissionManifest (+4 more)

### Community 68 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext (+4 more)

### Community 69 - "preferences.ts"
Cohesion: 0.24
Nodes (12): extractPreferenceUpdates(), GET(), PREFERENCE_KEYS, PreferenceUpdates, PUT(), toApiShape(), COLUMN_MAP, DEFAULT_PREFERENCES (+4 more)

### Community 70 - "hooks/use-toast.ts"
Cohesion: 0.21
Nodes (12): Action, ActionType, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState, reducer() (+4 more)

### Community 71 - "processAcknowledgementAutomation.ts"
Cohesion: 0.25
Nodes (12): AutomaticAcknowledgementTiming, getObservationReminderPeriod(), isAutomaticAcknowledgementDue(), ReminderTiming, ObservationNotificationSettings, automaticallyAcknowledgeParticipant(), claimReminder(), ObservationAutomationOptions (+4 more)

### Community 72 - "Multi-teacher observations rollout"
Cohesion: 0.15
Nodes (13): Automated verification, Database verification, Deployment, Every observation has participants, Monitoring, Multi-teacher observations rollout, No duplicate participant membership, Parent lifecycle agrees with participants (+5 more)

### Community 73 - "toast.tsx"
Cohesion: 0.23
Nodes (11): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, src_components_ui_toast_toastprovider (+3 more)

### Community 74 - "effective-user-access.ts"
Cohesion: 0.26
Nodes (11): POST(), GET(), ProofPointRole, rolesWithinLocalDepartmentScope(), effectiveRolesForLocalUser(), EffectiveUser, findFirstLocalUserWithEffectiveRole(), findLocalUsersWithEffectiveRoles() (+3 more)

### Community 75 - "Procedure"
Cohesion: 0.17
Nodes (11): 1. Inventory and preflight, 2. Create source and rollback dumps, 3. Replace staging, 4. Verify application startup, 5. Verify database parity, Current Komodo mapping, Procedure, Production-to-Staging Database Refresh (+3 more)

### Community 76 - "3. Implementation increments"
Cohesion: 0.17
Nodes (11): 1. Delivery strategy, 2. Architecture and constraints, 3. Implementation increments, 4. Validation environment requirements, 5. Completion rule, Appraisal, Observation, and Department Administration UX — Implementation Plan, Increment A — Self-assessment presentation, Increment B — Observation confidentiality (+3 more)

### Community 77 - "observation-performance-check.ts"
Cohesion: 0.18
Nodes (10): ref_node_crypto, ref_node_perf_hooks, BASELINE_PATH, baselineChecksum, FORWARD_MIGRATIONS, pool, REQUIRED_TABLES, observationListQuerySchema (+2 more)

### Community 78 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 79 - "available-forms/route.ts"
Cohesion: 0.33
Nodes (10): availableForms(), GET(), parseStaffIds(), POST(), StaffAccessRow, GET(), StaffRow, canObserve() (+2 more)

### Community 80 - "prisma.ts"
Cohesion: 0.25
Nodes (8): databaseUrl, prisma, @prisma/adapter-pg, requireDatabaseUrl(), resolveDatabaseUrl(), createPrismaClient(), globalForPrisma, prisma

### Community 81 - "context-menu.tsx"
Cohesion: 0.18
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut() (+2 more)

### Community 82 - "ProofPoint Engineering Constitution"
Cohesion: 0.18
Nodes (10): 1. ProofPoint Identity, MWS Design Authority, 2. Semantic Design Tokens Are Mandatory, 3. Complete System Consistency, 4. Component and Architecture Standards, 5. UX and Accessibility, 6. Quality and Testing Standards, 7. Performance and Resilience, 8. Security, Privacy, and Observability (+2 more)

### Community 83 - "deploy.sh"
Cohesion: 0.44
Nodes (8): backup_database(), check_dependencies(), deploy_to_server(), log_error(), log_info(), main(), rollback(), deploy.sh script

### Community 84 - "Appraisal, Observation, and Department Administration UX — Tasks"
Cohesion: 0.20
Nodes (9): Appraisal, Observation, and Department Administration UX — Tasks, Authenticated browser validation matrix, Current completion summary, Phase 1 — Foundations, Phase 2 — Self-assessment presentation, Phase 3 — Observation confidentiality, Phase 4 — Active-appraisal dialog, Phase 5 — Department Structure (+1 more)

### Community 85 - "pagination.tsx"
Cohesion: 0.20
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 86 - "Observation acknowledgement automation"
Cohesion: 0.22
Nodes (8): Automated verification, Configuration ownership, Delivery and concurrency behavior, Mandatory workflow email policy, Observation acknowledgement automation, Operational checks, Scheduler lifecycle, Scheduler observability

### Community 87 - "eslint.config.mjs"
Cohesion: 0.22
Nodes (8): eslintConfig, ref_eslint_js, ref_eslint_plugin_react, ref_eslint_plugin_react_hooks, ref_globals, ref_next_eslint_plugin_next, ref_typescript_eslint_eslint_plugin, ref_typescript_eslint_parser

### Community 88 - "prisma-client.ts"
Cohesion: 0.39
Nodes (6): createPrismaClient(), main(), prisma, seedMilestone1(), prisma, @prisma/client

### Community 89 - "navigation-menu.tsx"
Cohesion: 0.25
Nodes (8): @radix-ui/react-navigation-menu, NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 90 - "breadcrumb.tsx"
Cohesion: 0.22
Nodes (8): @radix-ui/react-slot, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 91 - "drawer.tsx"
Cohesion: 0.22
Nodes (7): vaul, DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 92 - "guardedMutation"
Cohesion: 0.25
Nodes (8): 8. UI Components, GoalEditor(), guardedMutation(), ObjectiveEditor(), PlanList(), ProgramEditor(), ProgramProgressPanel(), ProgramStatus

### Community 93 - "flattenPrograms"
Cohesion: 0.29
Nodes (8): BudgetView(), flattenPrograms(), jsonFetch(), PlanMetadataEditor(), PlanOverview(), planStats(), ProgramDirectory(), TargetsMatrix()

### Community 94 - "Department Membership Source of Truth Rollout"
Cohesion: 0.29
Nodes (6): Audit tables, Department Membership Source of Truth Rollout, Deployment, Rollback and recovery, Summary, Verification

### Community 96 - "seed-it-support-staff-appraisal.ts"
Cohesion: 0.29
Nodes (5): Area, Item, Part, parts, pool

### Community 97 - "assessmentStatus.ts"
Cohesion: 0.38
Nodes (6): AssessmentStatus, getCurrentStep(), getStatusInfo(), getStatusLabel(), STATUS_CONFIG, StatusInfo

### Community 98 - "What the application supports today"
Cohesion: 0.33
Nodes (6): Appraisals, Experience and accessibility, Observations, Organization and administration, Strategic planning, What the application supports today

### Community 99 - "input-otp.tsx"
Cohesion: 0.33
Nodes (5): input-otp, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 100 - "sheet.tsx"
Cohesion: 0.40
Nodes (5): SheetContent, SheetContentProps, SheetFooter(), SheetOverlay, sheetVariants

### Community 101 - "4. User Stories"
Cohesion: 0.40
Nodes (5): 4. User Stories, US-1 — Complete a self-assessment without repeated expansion (P1), US-2 — Keep unfinished observations private from staff subjects (P1), US-3 — Present the existing-appraisal decision safely in a dialog (P2), US-4 — Manage departments and people from an understandable organization view (P2)

### Community 102 - "6. Acceptance Scenarios"
Cohesion: 0.40
Nodes (5): 6. Acceptance Scenarios, Department administration, Dialog, Observation visibility, Self-assessment

### Community 103 - "avatar.tsx"
Cohesion: 0.40
Nodes (4): @radix-ui/react-avatar, Avatar, AvatarFallback, AvatarImage

### Community 104 - "icon.tsx"
Cohesion: 0.40
Nodes (3): contentType, runtime, size

### Community 105 - "ObservationSummaryCards.tsx"
Cohesion: 0.40
Nodes (4): ObservationSummaryCards(), RoleView, SummaryCard, ObservationSummaryCounts

### Community 106 - "scroll-area.tsx"
Cohesion: 0.50
Nodes (3): @radix-ui/react-scroll-area, ScrollArea, ScrollBar

### Community 107 - "resizable.tsx"
Cohesion: 0.50
Nodes (3): react-resizable-panels, ResizableHandle(), ResizablePanelGroup()

### Community 112 - "NewStaffAppraisal"
Cohesion: 1.00
Nodes (3): NewStaffAppraisal(), create(), discardDraftAndCreate()

## Knowledge Gaps
- **780 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+775 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 943 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `director/page.tsx`, `ObservationRubricPreviewDialog.tsx`, `components/ObservationFormEditor.tsx`, `admin/page.tsx`, `users/route.ts`, `useAuth`, `auth`, `package.json`, `ObservationDetailReport.tsx`, `central-sync.ts`, `submit/route.ts`, `[indicatorId]/route.ts`, `ObservationList.tsx`, `queryOne`, `[id]/route.ts`, `strategic-plans.ts`, `notification-settings/page.tsx`, `isHubAuthEnabled`, `role-workflow-assignments/route.ts`, `observationAcknowledgementScheduler.ts`, `ObservationListPage.tsx`, `observation-api.integration-test.ts`, `StrategicPlansClient.tsx`, `providers.tsx`, `action/route.ts`, `notificationSettings.ts`, `workflow-definitions/route.ts`, `hub-auth.ts`, `ref_node_assert`, `[id]/evidence/route.ts`, `api/assessments/route.ts`, `storage.ts`, `observations/route.ts`, `rubric-authorization.ts`, `preferences.ts`, `effective-user-access.ts`, `available-forms/route.ts`, `icon.tsx`, `ObservationSummaryCards.tsx`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **Why does `Strategic Planning Module — Spec` connect `Strategic Planning Module — Spec` to `strategic-plans.ts`, `guardedMutation`, `README.md`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `director/page.tsx`, `lucide-react`, `ObservationRubricPreviewDialog.tsx`, `components/ObservationFormEditor.tsx`, `admin/page.tsx`, `useAuth`, `ObservationDetailReport.tsx`, `[indicatorId]/route.ts`, `assessment/index.ts`, `ObservationList.tsx`, `sidebar.tsx`, `notification-settings/page.tsx`, `ObservationListPage.tsx`, `react`, `ObservationCreationWizard`, `carousel.tsx`, `form.tsx`, `toast.tsx`, `chart.tsx`, `context-menu.tsx`, `pagination.tsx`, `navigation-menu.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `input-otp.tsx`, `sheet.tsx`, `avatar.tsx`, `scroll-area.tsx`, `resizable.tsx`, `hover-card.tsx`, `slider.tsx`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _780 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `director/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0700152207001522 - nodes in this community are weakly interconnected._
- **Should `ApiClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05754475703324808 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.031746031746031744 - nodes in this community are weakly interconnected._
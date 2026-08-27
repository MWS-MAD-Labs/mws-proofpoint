export const OBSERVATION_STATUSES = [
  "draft",
  "submitted",
  "acknowledged",
] as const;

export const LEGACY_OBSERVATION_STATUSES = ["pending", "reviewed"] as const;

export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];
export type LegacyObservationStatus =
  (typeof LEGACY_OBSERVATION_STATUSES)[number];
export type ObservationStatusInput =
  | ObservationStatus
  | LegacyObservationStatus;

export const OBSERVATION_QUESTION_TYPES = ["SCALE", "TEXT", "CHOICE"] as const;
export type ObservationQuestionType =
  (typeof OBSERVATION_QUESTION_TYPES)[number];

export const OBSERVATION_SCOPE_TYPES = [
  "INDIVIDUAL",
  "CLASS",
  "SUBJECT",
] as const;
export type ObservationScopeType = (typeof OBSERVATION_SCOPE_TYPES)[number];

export const OBSERVATION_ACKNOWLEDGEMENT_METHODS = [
  "personal",
  "automatic",
] as const;
export type ObservationAcknowledgementMethod =
  (typeof OBSERVATION_ACKNOWLEDGEMENT_METHODS)[number];

export interface ObservationActor {
  id: string;
  roles: readonly string[];
}

export interface ObservationAccessRecord {
  status: ObservationStatusInput;
  managerId: string | null;
  /** Precomputed with an observation_participants EXISTS query. */
  isParticipant?: boolean;
  /** The current actor's participant acknowledgement timestamp. */
  participantAcknowledgedAt?: Date | string | null;
  /** The current actor's participant acknowledgement method. */
  participantAcknowledgementMethod?: ObservationAcknowledgementMethod | null;
  /** @deprecated Use isParticipant. Retained while singular routes migrate. */
  staffId?: string;
}

export interface ObservationPermissions {
  canViewRecord: boolean;
  canViewResponses: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canAcknowledge: boolean;
  canReopen: boolean;
  canReassign: boolean;
  canDelete: boolean;
}

export interface ObservationAnswerValue {
  score?: number | null;
  textValue?: string | null;
  selectedOption?: string | null;
}

export interface ObservationIndicatorForProgress {
  id: string;
  name: string;
  sectionId: string;
  sectionName: string;
  questionType: ObservationQuestionType;
  isRequired: boolean;
  scoreOptions?: readonly string[] | null;
  answer?: ObservationAnswerValue | null;
}

export interface ObservationProgress {
  requiredAnswered: number;
  requiredTotal: number;
  optionalAnswered: number;
  optionalTotal: number;
  percentage: number;
}

export interface IncompleteObservationIndicator {
  sectionId: string;
  sectionName: string;
  indicatorId: string;
  indicatorName: string;
}

export interface PersonSummary {
  id: string;
  email: string;
  fullName: string | null;
}

export interface ObservationParticipantSummary extends PersonSummary {
  department: { id: string; name: string } | null;
  acknowledgedAt: string | null;
  acknowledgementMethod: ObservationAcknowledgementMethod | null;
}

export interface ObservationParticipantDetail
  extends ObservationParticipantSummary {
  acknowledgementResponse: string | null;
  acknowledgementNote: string | null;
  acknowledgementResponseVisible: boolean;
}

export interface ObservationAcknowledgementProgress {
  acknowledged: number;
  total: number;
  pending: number;
  percentage: number;
}

export interface ObservationScope {
  type: ObservationScopeType;
  className: string | null;
  subjectName: string | null;
}

export interface ObservationListItem {
  id: string;
  title: string | null;
  status: ObservationStatus;
  participants: ObservationParticipantSummary[];
  /** @deprecated Use participants. The first participant is returned here. */
  staff: PersonSummary;
  manager: PersonSummary | null;
  department: { id: string; name: string } | null;
  rubric: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  observationDate: string | null;
  dueAt: string | null;
  submittedAt: string | null;
  /** @deprecated Use participants or acknowledgementProgress. */
  acknowledgedAt: string | null;
  scope: ObservationScope;
  acknowledgementProgress: ObservationAcknowledgementProgress;
  progress: ObservationProgress | null;
  isOverdue: boolean;
  isStale: boolean;
  nextAction: "continue" | "acknowledge" | "view" | "follow_up";
}

export interface ObservationSummaryCounts {
  draft: number;
  awaitingAcknowledgement: number;
  completed: number;
  actionRequired: number;
  overdue: number;
  stale: number;
  completedThisMonth: number;
}

export interface ObservationListResponse {
  data: ObservationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: ObservationSummaryCounts;
}

export interface ObservationSummaryResponse {
  counts: ObservationSummaryCounts;
  needsAttention: ObservationListItem[];
  recent: ObservationListItem[];
  pipeline: Array<{
    status: ObservationStatus;
    count: number;
  }>;
}

export interface ObservationDetailPerson {
  id: string;
  email: string;
  profile: {
    fullName: string | null;
    department?: { id: string; name: string } | null;
  };
}

export interface ObservationAnswer {
  id: string;
  indicatorId: string;
  observationId: string;
  score: number | null;
  note: string | null;
  evidence: string | null;
  textValue: string | null;
  selectedOption: string | null;
  selectedOptions: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export type ObservationAnswerInput =
  | { type: "SCALE"; score: number; note?: string }
  | { type: "TEXT"; textValue: string }
  | { type: "CHOICE"; selectedOption: string };

export interface ObservationAnswerSaveResponse {
  answer: ObservationAnswer;
  savedAt: string;
  progress: ObservationProgress;
}

export interface ObservationRubricIndicator {
  id: string;
  name: string;
  description: string | null;
  evidenceGuidance: string | null;
  sortOrder: number;
  questionType: ObservationQuestionType;
  scoreOptions: string[];
  isRequired: boolean;
}

export interface ObservationRubricSection {
  id: string;
  name: string;
  weight: number | null;
  sortOrder: number;
  indicators: ObservationRubricIndicator[];
}

export interface ObservationActivityEntry {
  id: string;
  eventType: string;
  statusFrom: ObservationStatus | null;
  statusTo: ObservationStatus;
  notes: string | null;
  createdAt: string;
  updatedBy: ObservationDetailPerson | null;
}

export interface ObservationDetail {
  id: string;
  /** @deprecated Use participants. */
  staffId: string;
  managerId: string | null;
  templateId: string;
  status: ObservationStatus;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  observationDate: string | null;
  dueAt: string | null;
  reopenedAt: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgementResponse: string | null;
  acknowledgementMethod: ObservationAcknowledgementMethod | null;
  acknowledgementNote: string | null;
  /** @deprecated Use participants. */
  staff: ObservationDetailPerson | null;
  participants?: ObservationParticipantDetail[];
  scope?: ObservationScope;
  acknowledgementProgress?: ObservationAcknowledgementProgress;
  manager: ObservationDetailPerson | null;
  rubric: {
    id: string;
    name: string;
    sections: ObservationRubricSection[];
  };
  answers?: ObservationAnswer[];
  activity: ObservationActivityEntry[];
  progress: ObservationProgress | null;
}

export interface ObservationDetailResponse {
  observation: ObservationDetail;
  permissions: ObservationPermissions;
}

export interface ObservationCreationStaff {
  id: string;
  email: string;
  fullName: string | null;
  department: { id: string; name: string } | null;
  roles: string[];
}

export interface ObservationCreationForm {
  id: string;
  name: string;
  description: string | null;
  templateType: "CLASSROOM_OBSERVATION" | "GENERIC";
  workflowId: string;
  workflowName: string;
  sectionCount: number;
  indicatorCount: number;
}

export interface ObservationManagerOption {
  id: string;
  email: string;
  fullName: string | null;
}

export interface CreateObservationResponse {
  observation: {
    id: string;
    status: ObservationStatus;
    title: string | null;
    description: string | null;
    observationDate: string | null;
    dueAt: string;
    participants: PersonSummary[];
    scope?: ObservationScope;
    /** @deprecated Use scope. */
    scopeType?: ObservationScopeType;
    /** @deprecated Use scope. */
    className?: string | null;
    /** @deprecated Use scope. */
    subjectName?: string | null;
    /** @deprecated Use participants. */
    staff?: PersonSummary;
    manager: PersonSummary;
    rubric: { id: string; name: string };
  };
}

export interface CreateObservationInput {
  staffIds: string[];
  /** @deprecated Use staffIds. */
  staffId?: string;
  rubricId: string;
  workflowId?: string;
  title?: string;
  description?: string;
  observationDate?: string;
  dueAt: string;
  scopeType?: ObservationScopeType;
  className?: string;
  subjectName?: string;
}

export interface ObservationAcknowledgeInput {
  response: string;
}

export interface UpdateObservationInput {
  managerId?: string;
  staffIds?: string[];
  title?: string;
  description?: string;
  observationDate?: string | null;
  dueAt?: string | null;
  scopeType?: ObservationScopeType;
  className?: string | null;
  subjectName?: string | null;
}

// Assessment status labels and helpers

export type AssessmentStatus =
  | 'draft'
  | 'self_submitted'
  | 'manager_reviewed'
  | 'acknowledged'
  | 'director_approved'
  | 'rejected'
  | 'returned';

export interface StatusInfo {
  label: string;
  description: string;
  step: number;
}

export const STATUS_CONFIG: Record<AssessmentStatus, StatusInfo> = {
  draft: {
    label: 'Draft',
    description: 'In progress - not yet submitted',
    step: 1,
  },
  self_submitted: {
    label: 'Submitted',
    description: 'Awaiting manager appraisal',
    step: 1,
  },
  manager_reviewed: {
    label: 'Manager Reviewed',
    description: 'Awaiting director approval',
    step: 2,
  },
  director_approved: {
    label: 'Director Approved',
    description: 'Awaiting staff acknowledgement',
    step: 3,
  },
  acknowledged: {
    label: 'Acknowledged',
    description: 'Assessment complete',
    step: 4,
  },
  rejected: {
    label: 'Rejected',
    description: 'Sent back for revision',
    step: 3,
  },
  returned: {
    label: 'Returned',
    description: 'Returned for revision - please review feedback',
    step: 1,
  },
};

export function getStatusInfo(status: string | undefined | null): StatusInfo {
  if (!status) {
    return {
      label: 'Initializing',
      description: 'Loading assessment status...',
      step: 0,
    };
  }

  return STATUS_CONFIG[status as AssessmentStatus] || {
    label: status.replace('_', ' '),
    description: '',
    step: 0,
  };
}

export function getStatusLabel(status: string | undefined | null): string {
  return getStatusInfo(status).label;
}

export function getCurrentStep(status: string | undefined | null): number {
  return getStatusInfo(status).step;
}


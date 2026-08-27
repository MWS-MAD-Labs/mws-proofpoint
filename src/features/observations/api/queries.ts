import type {
  ObservationListQuery,
  ObservationReopenInput,
} from "../schemas";
import type {
  ObservationAcknowledgeInput,
  ObservationAnswerInput,
  ObservationAnswerSaveResponse,
  ObservationCreationForm,
  ObservationCreationStaff,
  ObservationDetailResponse,
  ObservationListResponse,
  ObservationManagerOption,
  ObservationSummaryResponse,
  CreateObservationInput,
  CreateObservationResponse,
  UpdateObservationInput,
} from "../types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function observationListSearchParams(filters: ObservationListQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
}

export function fetchObservationList(filters: ObservationListQuery) {
  return getJson<ObservationListResponse>(
    `/api/observations?${observationListSearchParams(filters).toString()}`,
  );
}

export function fetchObservationSummary() {
  return getJson<ObservationSummaryResponse>("/api/observations/summary");
}

export function fetchObservationDetail(id: string) {
  return getJson<ObservationDetailResponse>(`/api/observations/${id}`);
}

export function fetchObservationCreationStaff() {
  return getJson<ObservationCreationStaff[]>("/api/observations/staff");
}

export async function fetchObservationCreationForms(
  staffIds: string[],
): Promise<ObservationCreationForm[]> {
  const response = await fetch("/api/observations/available-forms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ staffIds }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<ObservationCreationForm[]>;
}

export async function fetchObservationManagers(): Promise<ObservationManagerOption[]> {
  const managers = await getJson<Array<{
    id: string;
    email: string;
    profile?: { fullName: string | null };
  }>>("/api/managers");
  return managers.map((manager) => ({
    id: manager.id,
    email: manager.email,
    fullName: manager.profile?.fullName ?? null,
  }));
}

export type CreateObservationRequestInput = Omit<CreateObservationInput, "staffId">;

export async function createObservation(
  input: CreateObservationRequestInput,
): Promise<CreateObservationResponse> {
  const response = await fetch("/api/observations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  const body = (await response.json()) as CreateObservationResponse & {
    observation: CreateObservationResponse["observation"] & {
      scopeType?: NonNullable<
        CreateObservationResponse["observation"]["scope"]
      >["type"];
      className?: string | null;
      subjectName?: string | null;
    };
  };
  return {
    ...body,
    observation: {
      ...body.observation,
      scope: body.observation.scope ?? {
        type: body.observation.scopeType ?? "INDIVIDUAL",
        className: body.observation.className ?? null,
        subjectName: body.observation.subjectName ?? null,
      },
    },
  };
}

export async function updateObservation(
  id: string,
  input: UpdateObservationInput,
): Promise<void> {
  const response = await fetch(`/api/observations/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
}

export async function deleteObservation(id: string): Promise<void> {
  const response = await fetch(`/api/observations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
}

export async function saveObservationAnswer(
  observationId: string,
  indicatorId: string,
  input: ObservationAnswerInput,
  signal?: AbortSignal,
): Promise<ObservationAnswerSaveResponse> {
  const response = await fetch(
    `/api/observations/${observationId}/answers/${indicatorId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<ObservationAnswerSaveResponse>;
}

async function patchObservationTransition(
  id: string,
  action: string,
  body?: unknown,
): Promise<void> {
  const response = await fetch(`/api/observations/${id}/${action}`, {
    method: "PATCH",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
}

export function submitObservation(id: string): Promise<void> {
  return patchObservationTransition(id, "submit");
}

export function acknowledgeObservation(
  id: string,
  input: ObservationAcknowledgeInput,
): Promise<void> {
  return patchObservationTransition(id, "acknowledge", input);
}

export function reopenObservation(
  id: string,
  input: ObservationReopenInput,
): Promise<void> {
  return patchObservationTransition(id, "reopen", input);
}

export interface ObservationFilterOptions {
  departments: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; email: string; fullName: string | null }>;
  rubrics: Array<{ id: string; name: string }>;
}

export async function fetchObservationFilterOptions(
  includeDepartments: boolean,
  includeManagers: boolean,
): Promise<ObservationFilterOptions> {
  const [departmentResponse, managerResponse, rubricResponse] = await Promise.all([
    includeDepartments ? fetch("/api/departments") : Promise.resolve(null),
    includeManagers ? fetch("/api/managers") : Promise.resolve(null),
    fetch("/api/rubrics?templateType=CLASSROOM_OBSERVATION"),
  ]);

  if (departmentResponse && !departmentResponse.ok) throw new Error("Failed to load departments");
  if (managerResponse && !managerResponse.ok) throw new Error("Failed to load managers");
  if (!rubricResponse.ok) throw new Error("Failed to load observation forms");

  const departmentsBody = departmentResponse
    ? ((await departmentResponse.json()) as { data?: Array<{ id: string; name: string }> })
    : null;
  const managersBody = managerResponse
    ? ((await managerResponse.json()) as Array<{
        id: string;
        email: string;
        profile?: { fullName: string | null };
      }>)
    : [];
  const rubricsBody = (await rubricResponse.json()) as {
    data?: Array<{ id: string; name: string }>;
  };

  return {
    departments: departmentsBody?.data ?? [],
    managers: managersBody.map((manager) => ({
      id: manager.id,
      email: manager.email,
      fullName: manager.profile?.fullName ?? null,
    })),
    rubrics: rubricsBody.data ?? [],
  };
}

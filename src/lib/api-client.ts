/**
 * API Client for self-hosted backend
 * Provides a Supabase-like interface for easier migration
 */

type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

class ApiClient {
  private baseUrl = "/api";

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      let data: unknown = null;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${response.status})`;
        return { data: null, error: new Error(errorMessage) };
      }

      const responseData =
        typeof data === "object" && data !== null && "data" in data
          ? (data as { data?: T }).data
          : (data as T);

      return { data: responseData ?? null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Profiles
  async getProfiles(params?: QueryParams): Promise<ApiResponse<unknown[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/profiles${query ? `?${query}` : ""}`);
  }

  async getProfile(userId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/profiles?userId=${userId}`);
  }

  async updateProfile(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/profiles", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Departments
  async getDepartments(): Promise<ApiResponse<unknown[]>> {
    return this.request("/departments");
  }

  async createDepartment(data: {
    name: string;
    parent_id?: string;
  }): Promise<ApiResponse<unknown>> {
    return this.request("/departments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Assessments
  async getAssessments(params?: QueryParams): Promise<ApiResponse<unknown[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/assessments${query ? `?${query}` : ""}`);
  }

  async getAssessment(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/assessments?id=${id}`);
  }

  async createAssessment(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAssessment(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/assessments", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteAssessment(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/assessments?id=${id}`, {
      method: "DELETE",
    });
  }

  // Rubrics
  async getRubrics(): Promise<ApiResponse<unknown[]>> {
    return this.request("/rubrics");
  }

  async getRubric(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics?id=${id}`);
  }

  async createRubric(data: {
    name: string;
    description?: string;
    department_id?: string;
    is_global?: boolean;
  }): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRubric(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteRubric(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics?id=${id}`, {
      method: "DELETE",
    });
  }

  // Rubric Sections
  async createSection(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/sections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSection(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/sections", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteSection(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics/sections?id=${id}`, {
      method: "DELETE",
    });
  }

  // Rubric Indicators
  async createIndicator(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/indicators", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateIndicator(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/indicators", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteIndicator(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics/indicators?id=${id}`, {
      method: "DELETE",
    });
  }

  // KPI Domains
  async createDomain(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/domains", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateDomain(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/domains", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteDomain(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics/domains?id=${id}`, {
      method: "DELETE",
    });
  }

  // KPI Standards
  async createStandard(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/standards", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateStandard(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/standards", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteStandard(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics/standards?id=${id}`, {
      method: "DELETE",
    });
  }

  // KPIs
  async createKPI(
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/kpis", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateKPI(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/rubrics/kpis", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteKPI(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/rubrics/kpis?id=${id}`, {
      method: "DELETE",
    });
  }

  // Questions
  async getQuestions(params?: QueryParams): Promise<ApiResponse<unknown[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/questions${query ? `?${query}` : ""}`);
  }

  async createQuestion(data: {
    assessment_id: string;
    indicator_id?: string;
    question: string;
  }): Promise<ApiResponse<unknown>> {
    return this.request("/questions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async answerQuestion(
    id: string,
    response: string,
    status?: string,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/questions", {
      method: "PUT",
      body: JSON.stringify({ id, response, status }),
    });
  }

  // User Roles
  async getUserRoles(userId?: string): Promise<ApiResponse<unknown[]>> {
    const query = userId ? `?userId=${userId}` : "";
    return this.request(`/user-roles${query}`);
  }

  async assignRole(
    userId: string,
    role: string,
  ): Promise<ApiResponse<unknown>> {
    return this.request("/user-roles", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, role }),
    });
  }

  async removeRole(
    userId: string,
    role: string,
  ): Promise<ApiResponse<unknown>> {
    return this.request(`/user-roles?userId=${userId}&role=${role}`, {
      method: "DELETE",
    });
  }

  // ========== Admin API ==========

  // Admin - Users
  async getAdminUsers(userId?: string): Promise<ApiResponse<unknown[]>> {
    const query = userId ? `?userId=${userId}` : "";
    return this.request(`/admin/users${query}`);
  }

  async createUser(data: {
    email: string;
    password: string;
    full_name?: string;
    niy?: string;
    job_title?: string;
    department_id?: string;
    roles?: string[];
  }): Promise<ApiResponse<unknown>> {
    return this.request("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateUser(
    id: string,
    data: {
      full_name?: string;
      niy?: string;
      job_title?: string;
      department_id?: string;
      roles?: string[];
      password?: string;
      status?: string;
    },
  ): Promise<ApiResponse<unknown>> {
    return this.request("/admin/users", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteUser(
    userId: string,
    permanent = false,
  ): Promise<ApiResponse<unknown>> {
    return this.request(
      `/admin/users?userId=${userId}${permanent ? "&permanent=true" : ""}`,
      {
        method: "DELETE",
      },
    );
  }

  // Admin - Departments (extended)
  async updateDepartment(
    id: string,
    data: { name?: string; parent_id?: string | null },
  ): Promise<ApiResponse<unknown>> {
    return this.request("/departments", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteDepartment(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/departments?id=${id}`, {
      method: "DELETE",
    });
  }

  // Admin - Department Roles
  async getDepartmentRoles(
    departmentId?: string,
  ): Promise<ApiResponse<unknown[]>> {
    const query = departmentId ? `?departmentId=${departmentId}` : "";
    return this.request(`/admin/department-roles${query}`);
  }

  async createDepartmentRole(data: {
    department_id: string;
    role: string;
    default_template_id?: string;
    name?: string;
  }): Promise<ApiResponse<unknown>> {
    return this.request("/admin/department-roles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateDepartmentRole(
    id: string,
    data: {
      default_template_id?: string | null;
      name?: string;
    },
  ): Promise<ApiResponse<unknown>> {
    return this.request("/admin/department-roles", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteDepartmentRole(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/admin/department-roles?id=${id}`, {
      method: "DELETE",
    });
  }

  // Public - Workflows (for any authenticated user)
  async getWorkflows(
    departmentRoleId: string,
  ): Promise<ApiResponse<unknown[]>> {
    return this.request(`/workflows?departmentRoleId=${departmentRoleId}`);
  }

  // Admin - Approval Workflows
  async getApprovalWorkflows(
    departmentRoleId?: string,
  ): Promise<ApiResponse<unknown[]>> {
    const query = departmentRoleId
      ? `?departmentRoleId=${departmentRoleId}`
      : "";
    return this.request(`/admin/approval-workflows${query}`);
  }

  async createApprovalWorkflow(data: {
    department_role_id: string;
    step_order: number;
    approver_role: string;
    step_type: string;
  }): Promise<ApiResponse<unknown>> {
    return this.request("/admin/approval-workflows", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateApprovalWorkflow(
    id: string,
    data: {
      step_order?: number;
      approver_role?: string;
      step_type?: string;
    },
  ): Promise<ApiResponse<unknown>> {
    return this.request("/admin/approval-workflows", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteApprovalWorkflow(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/admin/approval-workflows?id=${id}`, {
      method: "DELETE",
    });
  }

  async deleteAllApprovalWorkflows(
    departmentRoleId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.request(
      `/admin/approval-workflows?departmentRoleId=${departmentRoleId}`,
      {
        method: "DELETE",
      },
    );
  }

  // Generic Methods
  async get<T>(
    endpoint: string,
    params?: QueryParams,
  ): Promise<ApiResponse<T>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const cleanEndpoint = endpoint.startsWith("/api")
      ? endpoint.slice(4)
      : endpoint;
    return this.request(`${cleanEndpoint}${query ? `?${query}` : ""}`);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const cleanEndpoint = endpoint.startsWith("/api")
      ? endpoint.slice(4)
      : endpoint;
    return this.request(cleanEndpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const cleanEndpoint = endpoint.startsWith("/api")
      ? endpoint.slice(4)
      : endpoint;
    return this.request(cleanEndpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const cleanEndpoint = endpoint.startsWith("/api")
      ? endpoint.slice(4)
      : endpoint;
    return this.request(cleanEndpoint, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient();

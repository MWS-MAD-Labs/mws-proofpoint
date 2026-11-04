import type { DomainData, KPIData } from "@/components/assessment";
import type {
  ObservationQuestionType,
  ObservationRubricSection,
} from "@/features/observations/types";

export interface RawKpiTemplateInput {
  id?: string;
  name?: string | null;
  description?: string | null;
  domains?: Array<{
    id: string;
    name?: string | null;
    weight?: number | null;
    standards?: Array<{
      id: string;
      name?: string | null;
      kpis?: Array<{
        id: string;
        name?: string | null;
        description?: string | null;
        evidence_guidance?: string | null;
        trainings?: string | null;
        rubric_4?: string | null;
        rubric_3?: string | null;
        rubric_2?: string | null;
        rubric_1?: string | null;
      }>;
    }>;
  }>;
}

export function buildKpiPreviewDomains(
  template: RawKpiTemplateInput | null | undefined,
  existingResponses: Record<
    string,
    { score: number | "X" | null; evidence: KPIData["evidence"] }
  > = {},
): DomainData[] {
  if (!template?.domains || !Array.isArray(template.domains)) {
    return [];
  }

  return template.domains.map((domain) => ({
    id: domain.id,
    name: domain.name?.trim() || "Untitled Domain",
    weight: typeof domain.weight === "number" ? domain.weight : 0,
    standards: (domain.standards || []).map((standard) => ({
      id: standard.id,
      name: standard.name?.trim() || "Untitled Standard",
      kpis: (standard.kpis || []).map((kpi) => {
        const saved = existingResponses[kpi.id];
        return {
          id: kpi.id,
          name: kpi.name?.trim() || "Untitled KPI",
          description: kpi.description?.trim() ? kpi.description : null,
          evidence_guidance: kpi.evidence_guidance?.trim()
            ? kpi.evidence_guidance
            : null,
          trainings: kpi.trainings?.trim() ? kpi.trainings : null,
          rubric_4: kpi.rubric_4 || "",
          rubric_3: kpi.rubric_3 || "",
          rubric_2: kpi.rubric_2 || "",
          rubric_1: kpi.rubric_1 || "",
          score: saved ? saved.score : null,
          evidence: saved ? saved.evidence : "",
        };
      }),
    })),
  }));
}

export function applyKpiPreviewUpdate(
  domains: DomainData[],
  kpiId: string,
  updates: Partial<KPIData>,
): DomainData[] {
  return domains.map((domain) => ({
    ...domain,
    standards: domain.standards.map((standard) => ({
      ...standard,
      kpis: standard.kpis.map((kpi) =>
        kpi.id === kpiId ? { ...kpi, ...updates } : kpi,
      ),
    })),
  }));
}

export interface RawObservationPreviewSource {
  selected: {
    id: string;
    name?: string | null;
    description?: string | null;
    sections?: Array<{
      id: string;
      name?: string | null;
      weight?: number | null;
      sort_order?: number | null;
      indicators?: Array<{
        id: string;
        name?: string | null;
        description?: string | null;
        evidence_guidance?: string | null;
        question_type?: string | null;
        score_options?: string[] | null;
        is_required?: boolean | null;
        sort_order?: number | null;
      }>;
    }>;
  } | null;
  editingTemplateInfo?: boolean;
  editName?: string;
  editDescription?: string;
  editingSectionId?: string | null;
  editingSectionName?: string;
  editingIndicator?: {
    id: string;
    name: string;
    description: string;
    evidence_guidance: string;
    question_type: string;
    score_options: string[];
    is_required: boolean;
    newOption?: string;
  } | null;
}

function normalizeQuestionType(
  raw: string | null | undefined,
): ObservationQuestionType {
  if (raw === "CHOICE" || raw === "TEXT" || raw === "SCALE") {
    return raw;
  }
  return "SCALE";
}

export function buildObservationPreviewTemplate(
  source: RawObservationPreviewSource,
): {
  id: string;
  name: string;
  description: string | null;
  sections: ObservationRubricSection[];
} | null {
  const { selected } = source;
  if (!selected) return null;

  const name =
    (source.editingTemplateInfo ? source.editName : selected.name)?.trim() ||
    "Untitled Observation Form";
  const rawDescription = source.editingTemplateInfo
    ? source.editDescription
    : selected.description;
  const description = rawDescription?.trim() ? rawDescription.trim() : null;

  const sections: ObservationRubricSection[] = (selected.sections || []).map(
    (section, sectionIndex) => {
      const sectionName =
        (source.editingSectionId === section.id
          ? source.editingSectionName
          : section.name
        )?.trim() || "Untitled Section";

      const indicators = (section.indicators || []).map(
        (indicator, indicatorIndex) => {
          const isEditingThis = source.editingIndicator?.id === indicator.id;
          const questionType = normalizeQuestionType(
            isEditingThis
              ? source.editingIndicator?.question_type
              : indicator.question_type,
          );

          let scoreOptions: string[] = [];
          if (questionType === "CHOICE") {
            const baseOptions = isEditingThis
              ? (source.editingIndicator?.score_options ?? [])
              : (indicator.score_options ?? []);
            const pendingOption = isEditingThis
              ? source.editingIndicator?.newOption?.trim()
              : undefined;
            const merged = pendingOption
              ? [...baseOptions, pendingOption]
              : [...baseOptions];
            scoreOptions = Array.from(
              new Set(merged.map((opt) => opt.trim()).filter(Boolean)),
            );
          }

          const rawName = isEditingThis
            ? source.editingIndicator?.name
            : indicator.name;
          const rawIndDesc = isEditingThis
            ? source.editingIndicator?.description
            : indicator.description;
          const rawGuidance = isEditingThis
            ? source.editingIndicator?.evidence_guidance
            : indicator.evidence_guidance;
          const isRequired = isEditingThis
            ? Boolean(source.editingIndicator?.is_required)
            : indicator.is_required !== false;

          return {
            id: indicator.id,
            sectionId: section.id,
            name: rawName?.trim() || "Untitled Indicator",
            description: rawIndDesc?.trim() ? rawIndDesc.trim() : null,
            evidenceGuidance: rawGuidance?.trim() ? rawGuidance.trim() : null,
            questionType,
            scoreOptions,
            isRequired,
            sortOrder: indicator.sort_order ?? indicatorIndex,
          };
        },
      );

      return {
        id: section.id,
        name: sectionName,
        weight: section.weight ?? 1,
        sortOrder: section.sort_order ?? sectionIndex,
        indicators,
      };
    },
  );

  return {
    id: selected.id,
    name,
    description,
    sections,
  };
}

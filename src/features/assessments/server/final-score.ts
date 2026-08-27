import type { PoolClient } from "pg";
import { calculateWeightedPercentageScore, getGradeFromScore } from "@/features/assessments/scoring";
import { isManagerLedAssessment } from "./lifecycle";

interface StoredAssessmentScores {
  id: string;
  templateId: string | null;
  managerId: string | null;
  workflowSnapshot: unknown;
  staffScores: unknown;
  managerScores: unknown;
  directorScores: unknown;
}

interface WeightedKpi {
  id: string;
  domainId: string;
  domainWeight: number | string;
  performanceWeight: number | string;
}

function asScoreMap(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function calculateDomainWeightedScore(
  kpis: WeightedKpi[],
  scores: Record<string, unknown>,
): number | null {
  const domains = new Map<string, {
    weight: number;
    weightedTotal: number;
    itemWeightTotal: number;
  }>();

  for (const kpi of kpis) {
    const rating = scores[kpi.id];
    if (typeof rating !== "number" || !Number.isFinite(rating)) continue;

    const domainWeight = Number(kpi.domainWeight);
    const itemWeight = Number(kpi.performanceWeight ?? 100);
    if (!Number.isFinite(domainWeight) || !Number.isFinite(itemWeight) || itemWeight < 0) continue;

    const domain = domains.get(kpi.domainId) ?? {
      weight: domainWeight,
      weightedTotal: 0,
      itemWeightTotal: 0,
    };
    domain.weightedTotal += rating * itemWeight;
    domain.itemWeightTotal += itemWeight;
    domains.set(kpi.domainId, domain);
  }

  let weightedTotal = 0;
  let domainWeightTotal = 0;
  for (const domain of domains.values()) {
    if (domain.itemWeightTotal <= 0) continue;
    weightedTotal += (domain.weightedTotal / domain.itemWeightTotal) * domain.weight;
    domainWeightTotal += domain.weight;
  }

  return domainWeightTotal > 0
    ? Number((weightedTotal / domainWeightTotal).toFixed(2))
    : null;
}

export async function calculateStoredAssessmentFinalResult(
  client: PoolClient,
  assessmentId: string,
): Promise<{ score: number; grade: string } | null> {
  const assessmentResult = await client.query<StoredAssessmentScores>(
    `SELECT id,
            template_id AS "templateId",
            manager_id AS "managerId",
            workflow_snapshot AS "workflowSnapshot",
            staff_scores AS "staffScores",
            manager_scores AS "managerScores",
            director_scores AS "directorScores"
     FROM assessments
     WHERE id = $1`,
    [assessmentId],
  );
  const assessment = assessmentResult.rows[0];
  if (!assessment?.templateId) return null;

  const kpiResult = await client.query<WeightedKpi>(
    `SELECT k.id,
            kd.id AS "domainId",
            kd.weight AS "domainWeight",
            k.performance_weight AS "performanceWeight"
     FROM kpis k
     JOIN kpi_standards ks ON ks.id = k.standard_id
     JOIN kpi_domains kd ON kd.id = ks.domain_id
     WHERE k.template_id = $1`,
    [assessment.templateId],
  );
  if (kpiResult.rows.length === 0) return null;

  const managerLed = isManagerLedAssessment(assessment);
  const isDirectSelfAssessment = !managerLed && assessment.managerId === null;
  const baseScores = asScoreMap(
    isDirectSelfAssessment ? assessment.staffScores : assessment.managerScores,
  );
  const scores = isDirectSelfAssessment
    ? { ...baseScores, ...asScoreMap(assessment.directorScores) }
    : baseScores;
  const score = managerLed
    ? calculateWeightedPercentageScore(
        kpiResult.rows.map((kpi) => ({
          managerScore: scores[kpi.id] as number | "X" | null | undefined,
          performanceWeight: Number(kpi.performanceWeight),
        })),
      )
    : calculateDomainWeightedScore(kpiResult.rows, scores);

  return score === null ? null : { score, grade: getGradeFromScore(score) };
}

export type Rating = number | "X" | null | undefined;

export interface ScoredKpi {
  score?: Rating;
  managerScore?: Rating;
  performanceWeight?: number | null;
}

/**
 * Calculates the original staff-appraisal result as a global weighted average:
 * Σ(rating × item percentage) ÷ Σ(item percentage).
 *
 * Item percentages are independent relative weights. They intentionally do not
 * need to total 100%; their total is used only as the divisor.
 */
export function calculateWeightedPercentageScore(
  kpis: Iterable<ScoredKpi>,
  type: "staff" | "manager" = "manager",
): number | null {
  let weightedTotal = 0;
  let percentageTotal = 0;

  for (const kpi of kpis) {
    const rating = type === "manager" ? kpi.managerScore : kpi.score;
    if (typeof rating !== "number" || !Number.isFinite(rating)) continue;

    const percentage = Number(kpi.performanceWeight ?? 100);
    if (!Number.isFinite(percentage) || percentage < 0) continue;

    weightedTotal += rating * percentage;
    percentageTotal += percentage;
  }

  return percentageTotal > 0
    ? Number((weightedTotal / percentageTotal).toFixed(2))
    : null;
}

export function getGradeFromScore(score: number): string {
  if (score >= 3.9) return "Exemplary";
  if (score >= 3.6) return "Trail Blazers";
  if (score >= 3.4) return "Rising Star";
  if (score >= 3.2) return "Solid Foundation";
  if (score >= 3.0) return "Developing Under Guidance";
  if (score >= 2.8) return "Needs Improvement";
  if (score >= 2.6) return "Performance Management";
  return "Below Threshold";
}

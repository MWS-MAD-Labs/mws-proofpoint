import { calculateWeightedPercentageScore, getGradeFromScore } from "../src/features/assessments/scoring";

const ratings = [
  [4, 50], [3, 50],
  [4, 100], [3, 100], [3, 100], [4, 100], [4, 100], [4, 100], [3, 100],
  [4, 100], [3, 100], [4, 100], [4, 100], [4, 100], [4, 100], [3, 100], [4, 100], [4, 100], [3, 100], [4, 100], [4, 100], [4, 100],
  [3, 50], [3, 100], [3, 100],
  [4, 25], [4, 25], [3, 25], [2, 25], [2, 25], [3, 50], [3, 25],
  [3, 50], [4, 50], [4, 50], [4, 50], [4, 50],
  [3, 50], [4, 50], [4, 50], [4, 50], [4, 50], [3, 50], [4, 50],
] as const;

const score = calculateWeightedPercentageScore(
  ratings.map(([managerScore, performanceWeight]) => ({ managerScore, performanceWeight })),
);
const grade = score === null ? null : getGradeFromScore(score);

if (score !== 3.6 || grade !== "Trail Blazers") {
  throw new Error(`Expected 3.60 / Trail Blazers; received ${score} / ${grade}.`);
}

console.log(`Ananta regression check passed: ${score.toFixed(2)} / ${grade}`);

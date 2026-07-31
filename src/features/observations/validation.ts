import type {
  IncompleteObservationIndicator,
  ObservationAnswerValue,
  ObservationIndicatorForProgress,
  ObservationProgress,
  ObservationQuestionType,
} from "./types";

export function isObservationAnswerComplete(
  questionType: ObservationQuestionType,
  answer: ObservationAnswerValue | null | undefined,
  scoreOptions: readonly string[] = [],
): boolean {
  if (!answer) return false;

  switch (questionType) {
    case "SCALE":
      return (
        typeof answer.score === "number" &&
        Number.isFinite(answer.score) &&
        Math.round(answer.score * 10) === answer.score * 10 &&
        answer.score >= 1 &&
        answer.score <= 4
      );
    case "TEXT":
      return (answer.textValue?.trim().length ?? 0) > 0;
    case "CHOICE": {
      const selectedOption = answer.selectedOption?.trim();
      if (!selectedOption) return false;
      return scoreOptions.length === 0 || scoreOptions.includes(selectedOption);
    }
  }
}

export function calculateObservationProgress(
  indicators: readonly ObservationIndicatorForProgress[],
): ObservationProgress {
  let requiredAnswered = 0;
  let requiredTotal = 0;
  let optionalAnswered = 0;
  let optionalTotal = 0;

  for (const indicator of indicators) {
    const complete = isObservationAnswerComplete(
      indicator.questionType,
      indicator.answer,
      indicator.scoreOptions ?? [],
    );

    if (indicator.isRequired) {
      requiredTotal += 1;
      if (complete) requiredAnswered += 1;
    } else {
      optionalTotal += 1;
      if (complete) optionalAnswered += 1;
    }
  }

  return {
    requiredAnswered,
    requiredTotal,
    optionalAnswered,
    optionalTotal,
    percentage:
      requiredTotal === 0
        ? 100
        : Math.round((requiredAnswered / requiredTotal) * 100),
  };
}

export function findIncompleteRequiredIndicators(
  indicators: readonly ObservationIndicatorForProgress[],
): IncompleteObservationIndicator[] {
  return indicators
    .filter(
      (indicator) =>
        indicator.isRequired &&
        !isObservationAnswerComplete(
          indicator.questionType,
          indicator.answer,
          indicator.scoreOptions ?? [],
        ),
    )
    .map((indicator) => ({
      sectionId: indicator.sectionId,
      sectionName: indicator.sectionName,
      indicatorId: indicator.id,
      indicatorName: indicator.name,
    }));
}

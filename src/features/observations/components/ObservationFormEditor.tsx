"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  RefreshCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitObservation } from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import { useObservationSaveState } from "../hooks/useObservationSaveState";
import type {
  IncompleteObservationIndicator,
  ObservationAnswerInput,
  ObservationAnswerValue,
  ObservationDetailResponse,
  ObservationRubricIndicator,
  ObservationRubricSection,
} from "../types";
import {
  calculateObservationProgress,
  findIncompleteRequiredIndicators,
  isObservationAnswerComplete,
} from "../validation";
import { formatRelativeDate } from "../utils";

type DraftValue = {
  score: string;
  note: string;
  textValue: string;
  selectedOption: string;
};

type DraftValues = Record<string, DraftValue>;

const EMPTY_VALUE: DraftValue = {
  score: "",
  note: "",
  textValue: "",
  selectedOption: "",
};

export function ObservationFormEditor({
  detail,
}: {
  detail: ObservationDetailResponse;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { observation, permissions } = detail;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftValues>(() =>
    Object.fromEntries(
      observation.rubric.sections.flatMap((section) =>
        section.indicators.map((indicator) => {
          const answer = observation.answers?.find(
            (candidate) => candidate.indicatorId === indicator.id,
          );
          return [
            indicator.id,
            {
              score:
                answer?.score && answer.score > 0 ? String(answer.score) : "",
              note: answer?.note ?? "",
              textValue: answer?.textValue ?? "",
              selectedOption: answer?.selectedOption ?? "",
            },
          ];
        }),
      ),
    ),
  );
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveState = useObservationSaveState(observation.id);

  const indicators = useMemo(
    () =>
      observation.rubric.sections.flatMap((section) =>
        section.indicators.map((indicator) => ({
          id: indicator.id,
          name: indicator.name,
          sectionId: section.id,
          sectionName: section.name,
          questionType: indicator.questionType,
          isRequired: indicator.isRequired,
          scoreOptions: indicator.scoreOptions,
          answer: draftAnswer(indicator, drafts[indicator.id] ?? EMPTY_VALUE),
        })),
      ),
    [drafts, observation.rubric.sections],
  );
  const progress = useMemo(
    () => calculateObservationProgress(indicators),
    [indicators],
  );
  const incomplete = useMemo(
    () => findIncompleteRequiredIndicators(indicators),
    [indicators],
  );
  const optionalUnanswered =
    progress.optionalTotal - progress.optionalAnswered;
  const sectionProgress = useMemo(
    () =>
      Object.fromEntries(
        observation.rubric.sections.map((section) => {
          const required = section.indicators.filter(
            (indicator) => indicator.isRequired,
          );
          const answered = required.filter((indicator) =>
            isObservationAnswerComplete(
              indicator.questionType,
              draftAnswer(indicator, drafts[indicator.id] ?? EMPTY_VALUE),
              indicator.scoreOptions,
            ),
          ).length;
          return [section.id, { answered, total: required.length }];
        }),
      ),
    [drafts, observation.rubric.sections],
  );

  const submit = useMutation({
    mutationFn: () => submitObservation(observation.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: observationKeys.detail(observation.id),
        }),
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
      ]);
      toast.success("Observation submitted for acknowledgement.");
      router.push(`/observations/${observation.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const scheduleSave = (
    indicator: ObservationRubricIndicator,
    value: DraftValue,
    delay = 700,
  ) => {
    const input = answerInput(indicator, value);
    if (!input) return;
    const existingTimer = timers.current.get(indicator.id);
    if (existingTimer) clearTimeout(existingTimer);
    saveState.markUnsaved(indicator.id, input);
    timers.current.set(
      indicator.id,
      setTimeout(() => void saveState.save(indicator.id, input), delay),
    );
  };

  const updateDraft = (
    indicator: ObservationRubricIndicator,
    update: Partial<DraftValue>,
    mode: "debounce" | "immediate" | "manual" = "debounce",
  ) => {
    const next = { ...(drafts[indicator.id] ?? EMPTY_VALUE), ...update };
    setDrafts((current) => ({ ...current, [indicator.id]: next }));
    const input = answerInput(indicator, next);
    if (!input) {
      const existingTimer = timers.current.get(indicator.id);
      if (existingTimer) clearTimeout(existingTimer);
      saveState.markUnsaved(indicator.id);
      return;
    }
    if (mode === "manual") saveState.markUnsaved(indicator.id, input);
    else if (mode === "immediate") {
      saveState.markUnsaved(indicator.id, input);
      void saveState.save(indicator.id, input);
    } else scheduleSave(indicator, next);
  };

  const saveOnBlur = (indicator: ObservationRubricIndicator) => {
    const input = answerInput(indicator, drafts[indicator.id] ?? EMPTY_VALUE);
    if (!input) return;
    const existingTimer = timers.current.get(indicator.id);
    if (existingTimer) clearTimeout(existingTimer);
    void saveState.save(indicator.id, input);
  };

  const scrollTo = (id: string) => {
    setReviewOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(`indicator-${id}`)?.scrollIntoView({
        behavior: preferredScrollBehavior(),
        block: "center",
      });
      document
        .querySelector<HTMLElement>(`[data-indicator-input="${id}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  if (!permissions.canEdit) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Editing is unavailable</AlertTitle>
        <AlertDescription>
          Only the assigned manager or an administrator can edit a draft
          observation.
        </AlertDescription>
      </Alert>
    );
  }

  const canSubmit =
    incomplete.length === 0 &&
    !saveState.hasPendingChanges &&
    !submit.isPending;

  return (
    <>
      <header className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/observations/${observation.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to summary
          </Link>
        </Button>
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Draft editor</Badge>
              <span className="text-sm text-muted-foreground">
                {observation.rubric.name}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {observation.title?.trim() || observation.rubric.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Observing {personName(observation.staff)} · Required responses save
              automatically.
            </p>
          </div>
          <div className="min-w-56 rounded-xl bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Required progress</span>
              <strong>
                {progress.requiredAnswered}/{progress.requiredTotal}
              </strong>
            </div>
            <Progress value={progress.percentage} className="mt-3 h-2" />
          </div>
        </div>
      </header>

      <div className="lg:hidden">
        <Label htmlFor="section-jump" className="mb-2 block">
          Jump to section
        </Label>
        <Select onValueChange={(sectionId) => scrollToSection(sectionId)}>
          <SelectTrigger id="section-jump">
            <SelectValue placeholder="Choose a section" />
          </SelectTrigger>
          <SelectContent>
            {observation.rubric.sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.name} · {sectionProgress[section.id]?.answered ?? 0}/
                {sectionProgress[section.id]?.total ?? 0}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <aside className="sticky top-24 hidden lg:block">
          <SectionNavigator
            sections={observation.rubric.sections}
            sectionProgress={sectionProgress}
            states={saveState.states}
            incomplete={incomplete}
            onIndicator={scrollTo}
          />
        </aside>

        <main className="min-w-0 space-y-6 pb-24 lg:pb-8">
          {observation.rubric.sections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Section
                  </p>
                  <h2 className="text-xl font-semibold">{section.name}</h2>
                </div>
                <Badge variant="outline">
                  {sectionProgress[section.id]?.answered ?? 0}/
                  {sectionProgress[section.id]?.total ?? 0} required
                </Badge>
              </div>
              {section.indicators.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-sm text-muted-foreground">
                    This section has no indicators.
                  </CardContent>
                </Card>
              ) : (
                section.indicators.map((indicator) => (
                  <IndicatorEditor
                    key={indicator.id}
                    indicator={indicator}
                    value={drafts[indicator.id] ?? EMPTY_VALUE}
                    state={saveState.states[indicator.id]}
                    onChange={(update, mode) =>
                      updateDraft(indicator, update, mode)
                    }
                    onBlur={() => saveOnBlur(indicator)}
                    onRetry={() => void saveState.save(indicator.id)}
                  />
                ))
              )}
            </section>
          ))}
        </main>

        <aside className="sticky top-24 hidden lg:block">
          <ActionPanel
            progress={progress}
            failedCount={saveState.failedCount}
            hasPendingChanges={saveState.hasPendingChanges}
            latestSavedAt={saveState.latestSavedAt}
            observationId={observation.id}
            onRetry={() => void saveState.retryFailed()}
            onReview={() => setReviewOpen(true)}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur lg:hidden">
        <div className="container flex items-center justify-between gap-3 px-0">
          <SaveSummary
            failedCount={saveState.failedCount}
            pending={saveState.hasPendingChanges}
            latestSavedAt={saveState.latestSavedAt}
          />
          <div className="flex shrink-0 gap-2">
            <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
              <Link href={`/observations/${observation.id}`}>Back</Link>
            </Button>
            {saveState.failedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveState.retryFailed()}
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </Button>
            )}
            <Button size="sm" onClick={() => setReviewOpen(true)}>
              Review
            </Button>
          </div>
        </div>
      </div>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        progress={progress}
        incomplete={incomplete}
        optionalUnanswered={optionalUnanswered}
        failedCount={saveState.failedCount}
        pending={saveState.hasPendingChanges}
        canSubmit={canSubmit}
        submitting={submit.isPending}
        onIndicator={scrollTo}
        onSubmit={() => submit.mutate()}
      />
    </>
  );
}

function IndicatorEditor({
  indicator,
  value,
  state,
  onChange,
  onBlur,
  onRetry,
}: {
  indicator: ObservationRubricIndicator;
  value: DraftValue;
  state?: ReturnType<typeof useObservationSaveState>["states"][string];
  onChange: (
    update: Partial<DraftValue>,
    mode?: "debounce" | "immediate" | "manual",
  ) => void;
  onBlur: () => void;
  onRetry: () => void;
}) {
  const scoreNumber = Number(value.score);
  const scoreInvalid =
    value.score !== "" &&
    (!Number.isFinite(scoreNumber) || scoreNumber < 1 || scoreNumber > 4 ||
      Math.round(scoreNumber * 10) !== scoreNumber * 10);
  const scoreDescriptions = [
    [1, "Beginning", "Performance is beginning to meet expectations."],
    [2, "Developing", "Performance is progressing toward expectations."],
    [3, "Proficient", "Performance consistently meets expectations."],
    [4, "Exemplary", "Performance consistently exceeds expectations."],
  ] as const;
  const selectedScoreDescription = value.score === ""
    ? null
    : scoreDescriptions.find(([score]) => score === Math.round(scoreNumber));
  const scoreColor =
    value.score === "" ? "accent-primary" :
    scoreNumber < 2 ? "accent-red-500" :
    scoreNumber < 3 ? "accent-amber-500" :
    scoreNumber < 4 ? "accent-emerald-500" : "accent-blue-500";
  const selectedDotColor =
    value.score === "" ? "bg-primary text-primary-foreground border-primary" :
    scoreNumber < 2 ? "bg-destructive text-white border-destructive/40" :
    scoreNumber < 3 ? "bg-warning text-white border-warning/40" :
    scoreNumber < 4 ? "bg-success text-white border-success/40" : "bg-primary text-white border-primary/40";

  return (
    <Card
      id={`indicator-${indicator.id}`}
      className={cn(
        "scroll-mt-28",
        state?.status === "failed" && "border-destructive/60",
      )}
    >
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{indicator.name}</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {indicator.questionType}
              </Badge>
              {indicator.isRequired && (
                <Badge variant="secondary" className="text-[10px]">
                  Required
                </Badge>
              )}
            </div>
            {indicator.description && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {indicator.description}
              </p>
            )}
          </div>
          <ItemSaveStatus state={state} onRetry={onRetry} />
        </div>
        {indicator.evidenceGuidance && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">Evidence guidance: </span>
            {indicator.evidenceGuidance}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {indicator.questionType === "SCALE" && (
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`score-${indicator.id}`}>Score (1–4)</Label>
                <output className="font-mono text-sm font-bold text-primary">
                  {value.score === "" ? "—" : Number(value.score).toFixed(1)}
                </output>
              </div>
              <div className="relative mt-3 h-9">
                <input
                  id={`score-${indicator.id}`}
                  data-indicator-input={indicator.id}
                  type="range"
                  min={1}
                  max={4}
                  step={0.1}
                  value={value.score === "" ? 1 : value.score}
                  aria-invalid={scoreInvalid}
                  aria-describedby={scoreInvalid ? `score-error-${indicator.id}` : undefined}
                  onChange={(event) => onChange({ score: event.target.value }, "manual")}
                  onBlur={onBlur}
                  className={cn("absolute inset-x-0 top-1/2 z-10 h-2 w-full -translate-y-1/2 cursor-pointer", scoreColor)}
                />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-between px-0.5">
                  {scoreDescriptions.map(([score]) => (
                    <span key={score} className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-md", Math.round(scoreNumber) === score ? selectedDotColor : "border-border bg-white text-muted-foreground dark:border-border dark:bg-foreground dark:text-muted-foreground")}>{score}</span>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 text-[10px] font-medium text-muted-foreground">
                {scoreDescriptions.map(([score, label], index) => <span key={score} className={cn(index === 0 ? "text-left" : index === 3 ? "text-right" : "text-center")}>{label}</span>)}
              </div>
              {selectedScoreDescription && <p className="mt-3 rounded-md bg-muted/50 p-2 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">{selectedScoreDescription[1]}: </span>{selectedScoreDescription[2]}</p>}
              {scoreInvalid && (
                <p id={`score-error-${indicator.id}`} role="alert" className="mt-2 text-xs text-destructive">
                  Enter a score from 1.0 to 4.0 in 0.1 increments.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={`note-${indicator.id}`}>Notes</Label>
              <Textarea
                id={`note-${indicator.id}`}
                value={value.note}
                onChange={(event) => onChange({ note: event.target.value })}
                onBlur={onBlur}
                placeholder="Record observations and supporting context..."
                className="mt-2 min-h-28"
              />
            </div>
          </div>
        )}
        {indicator.questionType === "TEXT" && (
          <div>
            <Label htmlFor={`text-${indicator.id}`}>Response</Label>
            <Textarea
              id={`text-${indicator.id}`}
              data-indicator-input={indicator.id}
              value={value.textValue}
              onChange={(event) =>
                onChange({ textValue: event.target.value })
              }
              onBlur={onBlur}
              placeholder="Write the observation response..."
              className="mt-2 min-h-36"
            />
          </div>
        )}
        {indicator.questionType === "CHOICE" &&
          (indicator.scoreOptions.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium">Select one option</legend>
              <div
                className="mt-3 grid gap-2 sm:grid-cols-2"
                data-indicator-input={indicator.id}
                tabIndex={-1}
              >
                {indicator.scoreOptions.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                      value.selectedOption === option &&
                        "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type="radio"
                      name={`choice-${indicator.id}`}
                      value={option}
                      checked={value.selectedOption === option}
                      onChange={() =>
                        onChange({ selectedOption: option }, "immediate")
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div>
              <Label htmlFor={`choice-${indicator.id}`}>Response</Label>
              <Input
                id={`choice-${indicator.id}`}
                data-indicator-input={indicator.id}
                value={value.selectedOption}
                onChange={(event) =>
                  onChange({ selectedOption: event.target.value })
                }
                onBlur={onBlur}
                placeholder="Enter the legacy choice value..."
                className="mt-2"
              />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function SectionNavigator({
  sections,
  sectionProgress,
  states,
  incomplete,
  onIndicator,
}: {
  sections: ObservationRubricSection[];
  sectionProgress: Record<string, { answered: number; total: number }>;
  states: ReturnType<typeof useObservationSaveState>["states"];
  incomplete: IncompleteObservationIndicator[];
  onIndicator: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sections.map((section) => {
          const progress = sectionProgress[section.id] ?? {
            answered: 0,
            total: 0,
          };
          const failed = section.indicators.some(
            (indicator) => states[indicator.id]?.status === "failed",
          );
          const firstIncomplete = incomplete.find(
            (item) => item.sectionId === section.id,
          );
          const complete = progress.answered === progress.total;
          return (
            <div key={section.id} className="rounded-lg border p-3">
              <button
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="flex w-full items-start gap-2 text-left"
              >
                {failed ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                ) : complete ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                ) : (
                  <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {section.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {progress.answered}/{progress.total} required
                  </span>
                </span>
              </button>
              {firstIncomplete && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto px-0 text-xs"
                  onClick={() => onIndicator(firstIncomplete.indicatorId)}
                >
                  First incomplete
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ActionPanel({
  progress,
  failedCount,
  hasPendingChanges,
  latestSavedAt,
  observationId,
  onRetry,
  onReview,
}: {
  progress: ReturnType<typeof calculateObservationProgress>;
  failedCount: number;
  hasPendingChanges: boolean;
  latestSavedAt: string | null;
  observationId: string;
  onRetry: () => void;
  onReview: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Progress & actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex justify-between text-sm">
            <span>Required</span>
            <strong>{progress.percentage}%</strong>
          </div>
          <Progress value={progress.percentage} className="mt-2 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {progress.requiredAnswered} of {progress.requiredTotal} required
            responses complete
          </p>
        </div>
        <SaveSummary
          failedCount={failedCount}
          pending={hasPendingChanges}
          latestSavedAt={latestSavedAt}
        />
        <div className="grid gap-2">
          {failedCount > 0 && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCcw className="h-4 w-4" />
              Retry failed saves
            </Button>
          )}
          <Button onClick={onReview}>
            <FileCheck2 className="h-4 w-4" />
            Review & submit
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/observations/${observationId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to summary
            </Link>
          </Button>

        </div>
      </CardContent>
    </Card>
  );
}

function SaveSummary({
  failedCount,
  pending,
  latestSavedAt,
}: {
  failedCount: number;
  pending: boolean;
  latestSavedAt: string | null;
}) {
  if (failedCount > 0) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {failedCount} save {failedCount === 1 ? "failed" : "failures"}
      </div>
    );
  }
  if (pending) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving changes…
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-success dark:text-success">
      <CheckCircle2 className="h-4 w-4" />
      <span>
        All changes saved
        {latestSavedAt ? ` ${formatRelativeDate(latestSavedAt)}` : ""}
      </span>
    </div>
  );
}

function ItemSaveStatus({
  state,
  onRetry,
}: {
  state?: ReturnType<typeof useObservationSaveState>["states"][string];
  onRetry: () => void;
}) {
  if (!state || state.status === "saved") {
    return (
      <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1 text-xs text-success dark:text-success">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  if (state.status === "saving") {
    return (
      <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving
      </span>
    );
  }
  if (state.status === "unsaved") {
    return (
      <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1 text-xs text-warning-foreground dark:text-warning-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        Unsaved
      </span>
    );
  }
  return (
    <div className="shrink-0 text-right">
      <span role="alert" className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Save failed
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 text-xs"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  progress,
  incomplete,
  optionalUnanswered,
  failedCount,
  pending,
  canSubmit,
  submitting,
  onIndicator,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: ReturnType<typeof calculateObservationProgress>;
  incomplete: IncompleteObservationIndicator[];
  optionalUnanswered: number;
  failedCount: number;
  pending: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onIndicator: (id: string) => void;
  onSubmit: () => void;
}) {
  const grouped = incomplete.reduce(
    (sections, item) => {
      (sections[item.sectionName] ??= []).push(item);
      return sections;
    },
    {} as Record<string, IncompleteObservationIndicator[]>,
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review observation</DialogTitle>
          <DialogDescription>
            Confirm completion and save reliability before sending this report to
            the staff member.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <ReviewMetric
            label="Required complete"
            value={`${progress.requiredAnswered}/${progress.requiredTotal}`}
          />
          <ReviewMetric label="Optional unanswered" value={optionalUnanswered} />
          <ReviewMetric label="Save failures" value={failedCount} />
        </div>
        {pending && failedCount === 0 && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Changes are still saving</AlertTitle>
            <AlertDescription>
              Wait until all changes are saved before submitting.
            </AlertDescription>
          </Alert>
        )}
        {incomplete.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-medium">Incomplete required indicators</h3>
            {Object.entries(grouped).map(([sectionName, items]) => (
              <div key={sectionName} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{sectionName}</p>
                <div className="mt-2 grid gap-1">
                  {items.map((item) => (
                    <Button
                      key={item.indicatorId}
                      type="button"
                      variant="ghost"
                      className="h-auto justify-start px-2 py-2 text-left"
                      onClick={() => onIndicator(item.indicatorId)}
                    >
                      <AlertCircle className="h-4 w-4 text-warning-foreground" />
                      <span className="whitespace-normal">{item.indicatorName}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle>Required responses are complete</AlertTitle>
            <AlertDescription>
              The observation is ready once all changes are safely saved.
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue editing
          </Button>
          <Button disabled={!canSubmit} onClick={onSubmit}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit observation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function answerInput(
  indicator: ObservationRubricIndicator,
  value: DraftValue,
): ObservationAnswerInput | null {
  if (indicator.questionType === "SCALE") {
    const score = Number(value.score);
    if (!Number.isFinite(score) || score < 1 || score > 4 || Math.round(score * 10) !== score * 10) return null;
    return { type: "SCALE", score, note: value.note };
  }
  if (indicator.questionType === "TEXT") {
    if (!value.textValue.trim()) return null;
    return { type: "TEXT", textValue: value.textValue };
  }
  if (!value.selectedOption.trim()) return null;
  if (
    indicator.scoreOptions.length > 0 &&
    !indicator.scoreOptions.includes(value.selectedOption)
  ) {
    return null;
  }
  return { type: "CHOICE", selectedOption: value.selectedOption };
}

function draftAnswer(
  indicator: ObservationRubricIndicator,
  value: DraftValue,
): ObservationAnswerValue {
  if (indicator.questionType === "SCALE") {
    return {
      score: value.score === "" ? null : Number(value.score),
    };
  }
  if (indicator.questionType === "TEXT") {
    return { textValue: value.textValue };
  }
  return { selectedOption: value.selectedOption };
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function scrollToSection(sectionId: string) {
  document.getElementById(`section-${sectionId}`)?.scrollIntoView({
    behavior: preferredScrollBehavior(),
    block: "start",
  });
}

function personName(person: ObservationDetailResponse["observation"]["staff"]) {
  return person?.profile.fullName?.trim() || person?.email || "Unknown staff";
}

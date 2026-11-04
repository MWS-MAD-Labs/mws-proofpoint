"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  ObservationAnswerValue,
  ObservationRubricIndicator,
} from "@/features/observations/types";
import {
  calculateObservationProgress,
  findIncompleteRequiredIndicators,
  isObservationAnswerComplete,
} from "@/features/observations/validation";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  buildObservationPreviewTemplate,
  type RawObservationPreviewSource,
} from "./rubric-preview-utils";

type DraftValue = {
  score: string;
  note: string;
  textValue: string;
  selectedOption: string;
};

const EMPTY_VALUE: DraftValue = {
  score: "",
  note: "",
  textValue: "",
  selectedOption: "",
};

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

interface ObservationRubricPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: RawObservationPreviewSource;
}

export function ObservationRubricPreviewDialog({
  open,
  onOpenChange,
  source,
}: ObservationRubricPreviewDialogProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});

  const template = useMemo(
    () => buildObservationPreviewTemplate(source),
    [source],
  );

  useEffect(() => {
    setDrafts({});
  }, [template?.id]);

  const indicators = useMemo(
    () =>
      (template?.sections || []).flatMap((section) =>
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
    [drafts, template?.sections],
  );

  const progress = useMemo(
    () => calculateObservationProgress(indicators),
    [indicators],
  );
  const incomplete = useMemo(
    () => findIncompleteRequiredIndicators(indicators),
    [indicators],
  );

  const sectionProgress = useMemo(
    () =>
      Object.fromEntries(
        (template?.sections || []).map((section) => {
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
    [drafts, template?.sections],
  );

  const updateDraft = (indicatorId: string, update: Partial<DraftValue>) => {
    setDrafts((current) => ({
      ...current,
      [indicatorId]: { ...(current[indicatorId] ?? EMPTY_VALUE), ...update },
    }));
  };

  const scrollToSection = (sectionId: string) => {
    document
      .getElementById(`preview-section-${sectionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToIndicator = (indicatorId: string) => {
    document
      .getElementById(`preview-indicator-${indicatorId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Preview as Observer
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {progress.requiredAnswered}/{progress.requiredTotal} Required
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold">
                {template.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {template.description || "Observation Form Fill-In Preview"}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDrafts({})}
              className="shrink-0 self-start sm:self-center"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset Responses
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm font-bold">
              Preview Mode — Responses are for testing only and will not be saved.
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Test how observers will fill in scale scores (1–100), single-choice options, and narrative responses, and verify required field progress before publishing.
            </AlertDescription>
          </Alert>

          {template.sections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No sections or indicators to preview yet.</p>
                <p className="text-xs mt-1">
                  Add at least one section and indicator in the editor to test filling in this observation form.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_16rem]">
              {/* Left: Section Navigator */}
              <aside className="space-y-3 lg:sticky lg:top-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Sections</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {template.sections.map((section) => {
                      const secProg = sectionProgress[section.id] ?? {
                        answered: 0,
                        total: 0,
                      };
                      const firstIncomplete = incomplete.find(
                        (item) => item.sectionId === section.id,
                      );
                      const complete = secProg.answered === secProg.total;
                      return (
                        <div key={section.id} className="rounded-lg border p-2.5">
                          <button
                            type="button"
                            onClick={() => scrollToSection(section.id)}
                            className="flex w-full items-start gap-2 text-left"
                          >
                            {complete ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-xs font-medium truncate">
                                {section.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {secProg.answered}/{secProg.total} required
                              </span>
                            </span>
                          </button>
                          {firstIncomplete && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="mt-1 h-auto px-0 text-[11px]"
                              onClick={() =>
                                scrollToIndicator(firstIncomplete.indicatorId)
                              }
                            >
                              First incomplete
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </aside>

              {/* Center: Interactive Form Indicators */}
              <main className="min-w-0 space-y-6">
                {template.sections.map((section) => (
                  <section
                    key={section.id}
                    id={`preview-section-${section.id}`}
                    className="scroll-mt-4 space-y-4"
                  >
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Section
                        </p>
                        <h3 className="text-lg font-semibold">{section.name}</h3>
                      </div>
                      <Badge variant="outline">
                        {sectionProgress[section.id]?.answered ?? 0}/
                        {sectionProgress[section.id]?.total ?? 0} required
                      </Badge>
                    </div>
                    {section.indicators.length === 0 ? (
                      <Card>
                        <CardContent className="py-6 text-sm text-muted-foreground">
                          This section has no indicators yet.
                        </CardContent>
                      </Card>
                    ) : (
                      section.indicators.map((indicator) => (
                        <PreviewIndicatorCard
                          key={indicator.id}
                          indicator={indicator}
                          value={drafts[indicator.id] ?? EMPTY_VALUE}
                          onChange={(update) =>
                            updateDraft(indicator.id, update)
                          }
                        />
                      ))
                    )}
                  </section>
                ))}
              </main>

              {/* Right: Progress Summary */}
              <aside className="space-y-3 lg:sticky lg:top-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Completion Check</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs">
                        <span>Required progress</span>
                        <strong>{progress.percentage}%</strong>
                      </div>
                      <Progress value={progress.percentage} className="mt-2 h-2" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {progress.requiredAnswered} of {progress.requiredTotal}{" "}
                        required responses complete
                      </p>
                    </div>

                    {progress.optionalTotal > 0 && (
                      <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                        Optional responses:{" "}
                        <strong className="text-foreground">
                          {progress.optionalAnswered}/{progress.optionalTotal}
                        </strong>
                      </div>
                    )}

                    <div className="rounded-lg border p-2.5 text-xs">
                      {incomplete.length === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          Ready for submission
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          <strong className="text-foreground">
                            {incomplete.length}
                          </strong>{" "}
                          required indicator{incomplete.length === 1 ? "" : "s"}{" "}
                          remaining before an observer could submit.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/10 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewIndicatorCard({
  indicator,
  value,
  onChange,
}: {
  indicator: ObservationRubricIndicator;
  value: DraftValue;
  onChange: (update: Partial<DraftValue>) => void;
}) {
  const scoreNumber = Number(value.score);
  const scoreInvalid =
    value.score !== "" &&
    (!Number.isInteger(scoreNumber) || scoreNumber < 1 || scoreNumber > 100);

  const isComplete = isObservationAnswerComplete(
    indicator.questionType,
    draftAnswer(indicator, value),
    indicator.scoreOptions,
  );

  return (
    <Card
      id={`preview-indicator-${indicator.id}`}
      className={cn(
        "scroll-mt-8 transition-colors",
        isComplete && "border-emerald-500/30 bg-emerald-500/[0.02]",
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
              <Badge
                variant={indicator.isRequired ? "secondary" : "outline"}
                className="text-[10px]"
              >
                {indicator.isRequired ? "Required" : "Optional"}
              </Badge>
            </div>
            {indicator.description && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {indicator.description}
              </p>
            )}
          </div>
          {isComplete && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </span>
          )}
        </div>
        {indicator.evidenceGuidance && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">
              Evidence guidance:{" "}
            </span>
            {indicator.evidenceGuidance}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {indicator.questionType === "SCALE" && (
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div>
              <Label htmlFor={`preview-score-${indicator.id}`}>
                Score (1–100)
              </Label>
              <Input
                id={`preview-score-${indicator.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={value.score}
                aria-invalid={scoreInvalid}
                onChange={(event) => onChange({ score: event.target.value })}
                className="mt-2"
              />
              {scoreInvalid && (
                <p
                  role="alert"
                  className="mt-2 text-xs text-destructive"
                >
                  Enter a whole number from 1 to 100.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={`preview-note-${indicator.id}`}>Notes</Label>
              <Textarea
                id={`preview-note-${indicator.id}`}
                value={value.note}
                onChange={(event) => onChange({ note: event.target.value })}
                placeholder="Record observations and supporting context..."
                className="mt-2 min-h-24"
              />
            </div>
          </div>
        )}
        {indicator.questionType === "TEXT" && (
          <div>
            <Label htmlFor={`preview-text-${indicator.id}`}>Response</Label>
            <Textarea
              id={`preview-text-${indicator.id}`}
              value={value.textValue}
              onChange={(event) => onChange({ textValue: event.target.value })}
              placeholder="Write the observation response..."
              className="mt-2 min-h-32"
            />
          </div>
        )}
        {indicator.questionType === "CHOICE" &&
          (indicator.scoreOptions.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium">Select one option</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                      name={`preview-choice-${indicator.id}`}
                      value={option}
                      checked={value.selectedOption === option}
                      onChange={() => onChange({ selectedOption: option })}
                      className="h-4 w-4 accent-primary"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div>
              <Label htmlFor={`preview-choice-${indicator.id}`}>Response</Label>
              <Input
                id={`preview-choice-${indicator.id}`}
                value={value.selectedOption}
                onChange={(event) =>
                  onChange({ selectedOption: event.target.value })
                }
                placeholder="Enter choice value (or add options in editor)..."
                className="mt-2"
              />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

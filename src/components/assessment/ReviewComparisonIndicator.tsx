import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";


export interface ReviewIndicatorData {
  id: string;
  name: string;
  description: string;
  rubric_4: string;
  rubric_3: string;
  rubric_2: string;
  rubric_1: string;
  evidence_guidance?: string | null;
  staffScore: number | "X" | null;
  staffEvidence: string | unknown[];
  managerScore: number | "X" | null;
  managerEvidence: string | unknown[];
  directorScore?: number | "X" | null;
  directorEvidence?: string | unknown[];
  performanceWeight?: number;
}

interface ReviewComparisonIndicatorProps {
  indicator: ReviewIndicatorData;
  index: number;
  onScoreChange?: (score: number | "X") => void;
  onEvidenceChange?: (evidence: string) => void;
  readonly?: boolean;
  reviewerLabel?: string;
  managerOnly?: boolean;
  directorMode?: boolean;
  showDirectorComparison?: boolean;
}

const scoreStyles: Record<number, string> = {
  1: "border-destructive/40 bg-destructive-soft text-destructive",
  2: "border-warning/40 bg-warning-soft text-warning-foreground",
  3: "border-success/40 bg-success-soft text-success",
  4: "border-primary bg-primary text-primary-foreground",
};

function ScoreBadge({ label, score, changed = false }: { label: string; score: number | "X" | null; changed?: boolean }) {
  const scoreStyle = typeof score === "number" ? scoreStyles[Math.round(score)] : undefined;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold", score === "X" ? "border-border bg-muted text-muted-foreground" : score === null ? "border-border bg-muted text-muted-foreground" : scoreStyle, changed && "ring-2 ring-warning/40 ring-offset-1")}>
      <span className="text-[10px] font-medium opacity-80">{label}</span>
      <span className="font-mono">{typeof score === "number" ? score.toFixed(1) : score ?? "—"}</span>
    </span>
  );
}

export function ReviewComparisonIndicator({
  indicator,
  index,
  onScoreChange,
  onEvidenceChange,
  readonly = false,
  reviewerLabel = "Manager",
  managerOnly = false,
  directorMode = false,
  showDirectorComparison = false,
}: ReviewComparisonIndicatorProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const activeScore = directorMode ? (indicator.directorScore ?? indicator.managerScore) : indicator.managerScore;
  const hasDirectorProposal = indicator.directorScore !== null && indicator.directorScore !== undefined;
  const scoreChanged = directorMode && hasDirectorProposal && indicator.directorScore !== indicator.managerScore;
  const feedback = directorMode ? indicator.directorEvidence : indicator.managerEvidence;
  const feedbackText = typeof feedback === "string" ? feedback : "";
  const feedbackRequired = directorMode && scoreChanged;
  const selectedRubricScore = typeof activeScore === "number" ? Math.round(activeScore) : null;
  const selectedRubricDescription = selectedRubricScore
    ? indicator[`rubric_${selectedRubricScore}` as "rubric_1" | "rubric_2" | "rubric_3" | "rubric_4"]
    : null;
  const scoreColor =
    typeof activeScore !== "number" ? "accent-primary" :
    activeScore < 2 ? "accent-red-500" :
    activeScore < 3 ? "accent-amber-500" :
    activeScore < 4 ? "accent-emerald-500" : "accent-blue-500";
  const selectedDotColor =
    typeof activeScore !== "number" ? "bg-primary text-primary-foreground border-primary" :
    activeScore < 2 ? "bg-destructive text-white border-destructive/40" :
    activeScore < 3 ? "bg-warning text-white border-warning/40" :
    activeScore < 4 ? "bg-success text-white border-success/40" : "bg-primary text-white border-primary/40";

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card px-3 py-3", scoreChanged && "border-warning/40 bg-warning/30")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">{index + 1}</span>
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{indicator.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!managerOnly && <ScoreBadge label="Self" score={indicator.staffScore} />}
          {(directorMode || showDirectorComparison) && <ScoreBadge label="Manager" score={indicator.managerScore} />}
          {(directorMode || showDirectorComparison) && <ScoreBadge label="Director" score={indicator.directorScore ?? indicator.managerScore} changed={scoreChanged} />}
        </div>
      </div>

      {!readonly && onScoreChange && (
        <div className="ml-9 rounded-md border bg-background px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium">{reviewerLabel} rating</span>
            <output className="font-mono font-bold text-primary">
              {typeof activeScore === "number" ? activeScore.toFixed(1) : "—"}
            </output>
          </div>
          <div className="relative h-9">
            <input
              aria-label={`${reviewerLabel} rating from 1 to 4`}
              type="range"
              min={1}
              max={4}
              step={0.1}
              value={typeof activeScore === "number" ? activeScore : 1}
              onChange={(event) => onScoreChange(Number(event.target.value))}
              className={cn("absolute inset-x-0 top-1/2 z-10 h-2 w-full -translate-y-1/2 cursor-pointer", scoreColor)}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-between px-0.5">
              {[1, 2, 3, 4].map((score) => (
                <span key={score} className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-md", selectedRubricScore === score ? selectedDotColor : "border-border bg-white text-muted-foreground dark:border-border dark:bg-foreground dark:text-muted-foreground")}>
                  {score}
                </span>
              ))}
            </div>
          </div>
          {selectedRubricDescription && <p className="mt-1 border-t pt-2 text-xs leading-5 text-muted-foreground">{selectedRubricDescription}</p>}
        </div>
      )}

      <div className="ml-9 flex flex-wrap items-center gap-2">
        {(!directorMode || scoreChanged || feedbackText) && (!readonly || feedbackText) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowFeedback((value) => !value)} className="h-8 gap-1 px-2 text-xs">
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {showFeedback ? "Hide feedback" : feedbackText ? "View feedback" : "Add feedback"}
          </Button>
        )}
      </div>

      {showFeedback && (
        <div className="w-full border-t pt-3 sm:basis-full">
          {readonly ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{feedbackText || "No feedback provided."}</p>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {reviewerLabel} feedback {feedbackRequired && <span className="text-destructive">(required for a changed score)</span>}
              </label>
              <Textarea
                value={feedbackText}
                onChange={(event) => onEvidenceChange?.(event.target.value)}
                placeholder="Add feedback only when it is needed..."
                className="min-h-20 resize-y text-sm"
              />
            </div>
          )}
        </div>
      )}

      {scoreChanged && <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-foreground"><UserCheck className="h-3.5 w-3.5" /> Revision requested</span>}
    </div>
  );
}

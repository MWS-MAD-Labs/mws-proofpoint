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
  1: "border-red-200 bg-red-50 text-red-700",
  2: "border-amber-200 bg-amber-50 text-amber-700",
  3: "border-emerald-200 bg-emerald-50 text-emerald-700",
  4: "border-primary bg-primary text-primary-foreground",
};

function ScoreBadge({ label, score, changed = false }: { label: string; score: number | "X" | null; changed?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold", score === "X" ? "border-slate-200 bg-slate-100 text-slate-500" : score === null ? "border-border bg-muted text-muted-foreground" : scoreStyles[score], changed && "ring-2 ring-amber-400 ring-offset-1")}>
      <span className="text-[10px] font-medium opacity-80">{label}</span>
      <span className="font-mono">{score ?? "—"}</span>
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

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card px-3 py-3 sm:flex-row sm:items-center", scoreChanged && "border-amber-300 bg-amber-50/30")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">{index + 1}</span>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{indicator.name}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {!managerOnly && <ScoreBadge label="Self" score={indicator.staffScore} />}
        <ScoreBadge label="Manager" score={indicator.managerScore} />
        {(directorMode || showDirectorComparison) && <ScoreBadge label="Director" score={indicator.directorScore ?? indicator.managerScore} changed={scoreChanged} />}

        {!readonly && onScoreChange && (
          <div className="flex overflow-hidden rounded-md border border-border">
            {[1, 2, 3, 4].map((score) => (
              <button
                key={score}
                type="button"
                aria-label={`Set ${reviewerLabel} score to ${score}`}
                onClick={() => onScoreChange(score)}
                className={cn("h-8 w-8 border-r text-xs font-black last:border-r-0", activeScore === score ? scoreStyles[score] : "bg-background text-muted-foreground hover:bg-muted")}
              >
                {score}
              </button>
            ))}
          </div>
        )}

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

      {scoreChanged && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><UserCheck className="h-3.5 w-3.5" /> Revision requested</span>}
    </div>
  );
}

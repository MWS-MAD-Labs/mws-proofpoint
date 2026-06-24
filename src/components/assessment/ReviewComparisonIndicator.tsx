import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, User, UserCheck, FileText, ExternalLink, Info, BookOpen, AlertCircle, Undo2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { EvidenceItem } from "./EvidenceInput";
import { ScoreSelector } from "./ScoreSelector";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export interface ReviewIndicatorData {
  id: string;
  name: string;
  description: string;
  rubric_4: string;
  rubric_3: string;
  rubric_2: string;
  rubric_1: string;
  evidence_guidance?: string | null;
  // Staff data
  staffScore: number | 'X' | null;
  staffEvidence: string | EvidenceItem[];
  // Manager data
  managerScore: number | 'X' | null;
  managerEvidence: string | EvidenceItem[];
}

interface ReviewComparisonIndicatorProps {
  indicator: ReviewIndicatorData;
  index: number;
  onScoreChange?: (score: number | 'X') => void;
  onEvidenceChange?: (evidence: string) => void;
  readonly?: boolean;
  reviewerLabel?: string;
}

function getScoreLabel(score: number | 'X' | null): string {
  if (score === null) return "Not rated";
  if (score === 'X') return "Not Implemented Yet";

  const labels: Record<number, string> = {
    1: "Beginning",
    2: "Developing",
    3: "Proficient",
    4: "Exemplary"
  };

  return labels[score as number];
}

function renderEvidenceContent(evidence: string | EvidenceItem[]) {
  if (!evidence) return <span className="text-muted-foreground italic">No evidence provided</span>;

  if (typeof evidence === 'string') {
    if (!evidence.trim()) return <span className="text-muted-foreground italic">No evidence provided</span>;
    return <p className="text-sm whitespace-pre-wrap">{evidence}</p>;
  }

  if (Array.isArray(evidence)) {
    const validItems = evidence.filter(e => e.evidence?.trim());
    if (validItems.length === 0) {
      return <span className="text-muted-foreground italic">No evidence provided</span>;
    }

    return (
      <div className="space-y-2">
        {validItems.map((item, idx) => (
          <div key={idx} className="text-sm">
            {item.evidence.startsWith('http') ? (
              <a
                href={item.evidence}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                <ExternalLink className="h-3 w-3" />
                {item.name || (item.evidence.length > 50 ? item.evidence.substring(0, 50) + '...' : item.evidence)}
              </a>
            ) : (
              <span className="font-medium text-foreground">{item.name || item.evidence}</span>
            )}
            {item.notes && (
              <p className="text-muted-foreground mt-1 pl-4 border-l-2 border-border italic">{item.notes}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function ReviewComparisonIndicator({
  indicator,
  index,
  onScoreChange,
  onEvidenceChange,
  readonly,
  reviewerLabel = "Manager Review"
}: ReviewComparisonIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const rubricDescriptions = {
    4: indicator.rubric_4,
    3: indicator.rubric_3,
    2: indicator.rubric_2,
    1: indicator.rubric_1,
  };

  const scoreDiff = (indicator.managerScore !== null && indicator.staffScore !== null && indicator.managerScore !== 'X' && indicator.staffScore !== 'X')
    ? Number(indicator.managerScore) - Number(indicator.staffScore)
    : null;

  const isManagerExcluded = indicator.managerScore === 'X';
  const isStaffExcluded = indicator.staffScore === 'X';
  const isExcluded = isManagerExcluded || (isStaffExcluded && indicator.managerScore === null);

  const isComplete = indicator.managerScore !== null; // Simplified completeness for review

  const statusColor = isExcluded
    ? "border-slate-200 bg-slate-50/50" // Changed from bg-slate-50 to match AssessmentIndicator
    : isComplete
      ? "border-emerald-200 bg-emerald-50/30"
      : "border-border hover:border-primary/30";

  return (
    <div className={cn(
      "border rounded-xl transition-all duration-200 bg-card group",
      statusColor,
      isExcluded && "opacity-50 grayscale", // Adjusted opacity to be more prominent
      isExpanded ? "shadow-md ring-1 ring-primary/5 opacity-100 grayscale-0" : "hover:shadow-sm" // Reset on expand
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 gap-4 outline-none"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0 text-left">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg text-xs font-mono font-bold shrink-0 transition-colors",
            isComplete && !isExcluded
              ? "bg-emerald-100 text-emerald-700"
              : isExcluded
                ? "bg-slate-200 text-slate-500"
                : "bg-primary/10 text-primary"
          )}>
            {isComplete && !isExcluded ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-bold text-sm truncate transition-colors",
              isComplete && !isExcluded ? "text-foreground" : "text-foreground/80 group-hover:text-primary",
              isExcluded && "text-slate-500"
            )}>
              {indicator.name}
            </h4>
            {!isExpanded && (
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Self: {indicator.staffScore ?? '-'}
                </span>
                <span className="opacity-20">|</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <UserCheck className="h-3 w-3 text-primary" />
                  {reviewerLabel}: {indicator.managerScore ?? '-'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Score comparison badges */}
          <div className="flex items-center gap-2">
            {!isExcluded && (
              <div className="text-[10px] text-muted-foreground font-mono mr-1 hidden sm:block">
                {indicator.managerScore === null ? 'Pending' : 'Rated'}
              </div>
            )}

            {/* Manager Score Badge */}
            {indicator.managerScore !== null && (
              <div className={cn(
                "px-3 py-1 rounded-md text-xs font-black font-mono shadow-sm border flex items-center gap-1.5",
                indicator.managerScore === 'X' && "bg-slate-100 text-slate-500 border-slate-200",
                indicator.managerScore === 1 && "bg-destructive/10 text-destructive border-destructive/20",
                indicator.managerScore === 2 && "bg-amber-50 text-amber-600 border-amber-200",
                indicator.managerScore === 3 && "bg-emerald-50 text-emerald-600 border-emerald-200",
                indicator.managerScore === 4 && "bg-primary text-primary-foreground border-primary"
              )}>
                {indicator.managerScore !== 'X' && <UserCheck className="h-3 w-3" />}
                {indicator.managerScore === 'X' ? 'N/A' : indicator.managerScore}
              </div>
            )}

            {/* Difference indicator */}
            {scoreDiff !== null && scoreDiff !== 0 && (
              <span className={cn(
                "ml-1 text-xs font-black px-1.5 py-0.5 rounded",
                scoreDiff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {scoreDiff > 0 ? '+' : ''}{scoreDiff}
              </span>
            )}
          </div>

          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-6 border-t border-border/50 animate-in slide-in-from-top-1 duration-200 pt-2">

          {/* Measurement Info */}
          <div className="mb-6">
            <div className="p-4 rounded-xl bg-background border border-border/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <BookOpen className="h-3.5 w-3.5" />
                Measurement Criteria
              </div>
              <p className="text-sm text-foreground leading-relaxed">{indicator.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Staff Assessment */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="bg-muted p-1 rounded-md">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Self Assessment</span>
              </div>

              <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-4">
                <div>
                  <div className={cn(
                    "inline-flex px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm items-center gap-2",
                    indicator.staffScore === 'X' && "bg-slate-100 text-slate-500 border border-slate-200",
                    indicator.staffScore !== 'X' && indicator.staffScore !== null && indicator.staffScore <= 1 && "bg-evidence-alert-bg text-evidence-alert border border-evidence-alert-border",
                    indicator.staffScore !== 'X' && indicator.staffScore === 2 && "bg-muted text-muted-foreground border border-border",
                    indicator.staffScore !== 'X' && indicator.staffScore !== null && indicator.staffScore >= 3 && "bg-emerald-50 text-emerald-600 border border-emerald-100",
                    indicator.staffScore === null && "bg-muted text-muted-foreground"
                  )}>
                    <span className="font-mono text-lg">{indicator.staffScore ?? '-'}</span>
                    <span className="w-px h-4 bg-black/10 mx-1" />
                    <span>{getScoreLabel(indicator.staffScore)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Evidence Provided</span>
                  </div>
                  <div className="bg-background rounded-lg border border-border/50 p-3 shadow-inner min-h-[60px]">
                    {renderEvidenceContent(indicator.staffEvidence)}
                  </div>
                </div>
              </div>
            </div>

            {/* Manager Assessment */}
            <div className="space-y-4 relative">

              {/* Excluded Overlay */}
              {isManagerExcluded && (
                <div className="absolute inset-0 z-20 bg-slate-50/50 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl border border-slate-200 border-dashed gap-4 animate-in fade-in">
                  <div className="bg-background/95 px-4 py-2.5 rounded-full shadow-sm border border-border/50 text-xs font-bold text-muted-foreground flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                    Excluded from {reviewerLabel}
                  </div>
                  {!readonly && onScoreChange && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onScoreChange({ score: null } as any)} // Cast needed because we wrapped it in object in parent but prop expects value
                      className="bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-sm h-8 text-xs font-bold gap-2"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Include Back
                    </Button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                <div className="bg-primary/10 p-1 rounded-md">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">{reviewerLabel}</span>
              </div>

              <div className={cn(
                "p-4 rounded-xl bg-primary/[0.02] border border-primary/10 space-y-6",
                isManagerExcluded && "opacity-20 pointer-events-none"
              )}>
                {!readonly && onScoreChange && onEvidenceChange ? (
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block mb-3">Assign Rating</span>
                      <ScoreSelector
                        value={indicator.managerScore}
                        onChange={onScoreChange}
                        rubricDescriptions={rubricDescriptions}
                        hideEvidenceRequirement={true}
                        hideNotImplemented={false}
                        disabled={indicator.staffScore === 'X'} // Optional: disable if staff marked X? Usually manager can override.
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary/60 uppercase tracking-widest">
                        <Info className="h-3.5 w-3.5" />
                        <span>Rationale & Feedback</span>
                      </div>
                      <Textarea
                        value={typeof indicator.managerEvidence === 'string' ? indicator.managerEvidence : ''}
                        onChange={(e) => onEvidenceChange(e.target.value)}
                        placeholder="Provide specific feedback, suggestions, or rationale for this score..."
                        className="min-h-[120px] bg-background border-primary/20 focus-visible:ring-primary/30"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block mb-2">Assigned Rating</span>
                      <div className={cn(
                        "inline-flex px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm items-center gap-2",
                        indicator.managerScore === 'X' && "bg-slate-100 text-slate-500 border border-slate-200",
                        indicator.managerScore === 1 && "bg-evidence-alert-bg text-evidence-alert border border-evidence-alert-border",
                        indicator.managerScore === 2 && "bg-muted text-muted-foreground border border-border",
                        indicator.managerScore === 3 && "bg-emerald-50 text-emerald-600 border border-emerald-100",
                        indicator.managerScore === 4 && "bg-primary text-primary-foreground border-primary",
                        indicator.managerScore === null && "bg-muted text-muted-foreground border border-border"
                      )}>
                        <span className="font-mono text-lg">{indicator.managerScore ?? '-'}</span>
                        <span className="w-px h-4 bg-black/10 mx-1" />
                        <span>{getScoreLabel(indicator.managerScore)}</span>
                      </div>
                      {indicator.managerScore !== null && indicator.managerScore !== 'X' && (
                        <p className="text-xs text-primary/80 mt-2 leading-relaxed font-medium italic">
                          {rubricDescriptions[indicator.managerScore as keyof typeof rubricDescriptions]}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block mb-2">{reviewerLabel.replace('Review', 'Feedback')}</span>
                      <div className="bg-background/80 rounded-lg border border-primary/10 p-3 shadow-inner min-h-[80px]">
                        {renderEvidenceContent(indicator.managerEvidence)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

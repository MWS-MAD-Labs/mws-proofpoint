import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScoreSelector } from "./ScoreSelector";
import { EvidenceInput, EvidenceItem } from "./EvidenceInput";
import { ChevronDown, ChevronUp, BookOpen, Info, Lightbulb, ShieldCheck, AlertCircle, CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface KPIData {
  id: string;
  name: string;
  description: string | null;
  score: number | 'X' | null;
  evidence: string | EvidenceItem[];
  rubric_4: string;
  rubric_3: string;
  rubric_2: string;
  rubric_1: string;
  evidence_guidance?: string | null;
  trainings?: string | null;
}

interface AssessmentIndicatorProps {
  indicator: KPIData;
  onChange: (updates: Partial<KPIData>) => void;
  index: number;
  readonly?: boolean;
}

export function AssessmentIndicator({ indicator, onChange, index, readonly = false }: AssessmentIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasEvidence = Array.isArray(indicator.evidence)
    ? indicator.evidence.some(e => e.evidence.trim().length > 0)
    : typeof indicator.evidence === 'string' && indicator.evidence.trim().length > 0;

  const isExcluded = indicator.score === 'X';

  const isComplete = indicator.score !== null && (
    isExcluded || hasEvidence
  );

  const rubricDescriptions = {
    4: indicator.rubric_4,
    3: indicator.rubric_3,
    2: indicator.rubric_2,
    1: indicator.rubric_1,
  };

  const statusColor = isExcluded
    ? "border-slate-200 bg-slate-50/50"
    : isComplete
      ? "border-emerald-200 bg-emerald-50/30"
      : "border-border hover:border-primary/30";

  return (
    <div className={cn(
      "border rounded-xl transition-all duration-200 bg-card group min-w-0",
      statusColor,
      isExcluded && "opacity-75 grayscale-[0.5]",
      isExpanded ? "shadow-md ring-1 ring-primary/5" : "hover:shadow-sm"
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
            isComplete
              ? (isExcluded ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700")
              : "bg-primary/10 text-primary"
          )}>
            {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-bold text-sm truncate transition-colors",
              isComplete ? "text-foreground" : "text-foreground/80 group-hover:text-primary"
            )}>
              {indicator.name}
            </h4>
            {!isExpanded && (
              <div className="flex items-center gap-3 mt-1">
                {indicator.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 flex-1">{indicator.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {indicator.score !== null && (
            <div className={cn(
              "px-3 py-1 rounded-md text-xs font-black font-mono shadow-sm border",
              indicator.score === 'X' && "bg-slate-100 text-slate-500 border-slate-200",
              indicator.score === 1 && "bg-destructive/10 text-destructive border-destructive/20",
              indicator.score === 2 && "bg-amber-50 text-amber-600 border-amber-200",
              indicator.score === 3 && "bg-emerald-50 text-emerald-600 border-emerald-200",
              indicator.score === 4 && "bg-primary text-primary-foreground border-primary"
            )}>
              {indicator.score === 'X' ? 'N/A' : indicator.score}
            </div>
          )}

          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-6 space-y-6 pt-2 animate-in slide-in-from-top-1 duration-200">
          <hr className="border-border/50 mb-4" />

          {/* Measurement Info */}
          {(indicator.description || indicator.evidence_guidance) && (
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-2 gap-4",
              isExcluded && "opacity-50 pointer-events-none"
            )}>
              {indicator.description && (
                <div className="p-4 rounded-xl bg-background border border-border/50 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <BookOpen className="h-3.5 w-3.5" />
                    Measurement Criteria
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{indicator.description}</p>
                </div>
              )}
              {indicator.evidence_guidance && (
                <div className="p-4 rounded-xl bg-primary/[0.02] border border-primary/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-primary uppercase tracking-wider">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Evidence Guide
                  </div>
                  <p className="text-sm text-foreground leading-relaxed italic opacity-90">{indicator.evidence_guidance}</p>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="space-y-6 relative">
            {isExcluded && (
              <div className="absolute inset-0 z-10 bg-slate-50/50 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl border border-slate-200 border-dashed gap-4 transition-all animate-in fade-in duration-300">
                <div className="bg-background/95 px-4 py-2.5 rounded-full shadow-sm border border-border/50 text-xs font-bold text-muted-foreground flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 text-slate-400" />
                  Excluded from Assessment
                </div>
                {!readonly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ score: null })}
                    className="bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-sm h-8 text-xs font-bold gap-2"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Include Back
                  </Button>
                )}
              </div>
            )}

            <div className={cn("transition-opacity duration-200", isExcluded && "opacity-40 select-none")}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Performance Rating
                </label>
              </div>
              <ScoreSelector
                value={indicator.score}
                onChange={(score) => onChange({ score })}
                disabled={readonly}
                rubricDescriptions={rubricDescriptions}
              />
            </div>

            <div className={cn("pt-2 transition-opacity duration-200", isExcluded && "opacity-40 select-none")}>
              <EvidenceInput
                score={indicator.score}
                value={indicator.evidence}
                onChange={(evidence) => onChange({ evidence })}
                disabled={readonly || isExcluded}
              />
            </div>
          </div>

          {indicator.trainings && !isExcluded && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Recommended Trainings
              </div>
              <p className="text-sm text-emerald-800">{indicator.trainings}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

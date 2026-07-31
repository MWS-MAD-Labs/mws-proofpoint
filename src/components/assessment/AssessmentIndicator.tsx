import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ScoreSelector } from "./ScoreSelector";
import { EvidenceInput, EvidenceItem } from "./EvidenceInput";
import { ChevronDown, ChevronUp, BookOpen, Info, Lightbulb, ShieldCheck, AlertCircle, CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface KPIData {
  id: string;
  name: string;
  description: string | null;
  score: number | "X" | null;
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
  evidenceRequiredAtOrAbove?: number;
  alwaysExpanded?: boolean;
}

function hasEvidence(value: string | EvidenceItem[]) {
  return Array.isArray(value)
    ? value.some((item) => item.evidence.trim().length > 0)
    : value.trim().length > 0;
}

export function AssessmentIndicator({
  indicator,
  onChange,
  index,
  readonly = false,
  evidenceRequiredAtOrAbove = 1,
  alwaysExpanded = false,
}: AssessmentIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const expanded = alwaysExpanded || isExpanded;
  const isExcluded = indicator.score === "X";
  const evidenceRequired = typeof indicator.score === "number" && indicator.score >= evidenceRequiredAtOrAbove;
  const isComplete = indicator.score !== null && (isExcluded || !evidenceRequired || hasEvidence(indicator.evidence));

  useEffect(() => {
    if (alwaysExpanded && evidenceRequired) setSupportOpen(true);
  }, [alwaysExpanded, evidenceRequired]);

  const rubricDescriptions = { 1: indicator.rubric_1, 2: indicator.rubric_2, 3: indicator.rubric_3, 4: indicator.rubric_4 };
  const statusColor = isExcluded ? "border-border bg-muted/50" : isComplete ? "border-success/40 bg-success/30" : "border-border hover:border-primary/30";

  const evidenceInput = (
    <EvidenceInput
      score={indicator.score === "X" ? null : indicator.score}
      value={indicator.evidence}
      onChange={(evidence) => onChange({ evidence })}
      disabled={readonly || isExcluded}
      evidenceGuidance={indicator.evidence_guidance ?? undefined}
      requireAtOrAbove={evidenceRequiredAtOrAbove}
    />
  );

  const measurementAndGuidance = (
    (indicator.description || indicator.evidence_guidance) && (
      <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", isExcluded && "pointer-events-none opacity-50")}>
        {indicator.description && (
          <div className="rounded-xl border border-border/50 bg-background p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><BookOpen className="h-3.5 w-3.5" />Measurement criteria</div>
            <p className="text-sm leading-relaxed text-foreground">{indicator.description}</p>
          </div>
        )}
        {indicator.evidence_guidance && (
          <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary"><Lightbulb className="h-3.5 w-3.5" />Evidence guide</div>
            <p className="text-sm leading-relaxed text-foreground/90">{indicator.evidence_guidance}</p>
          </div>
        )}
      </div>
    )
  );

  const excludedOverlay = isExcluded && (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/50 backdrop-blur-[2px]">
      <div className="flex items-center gap-2.5 rounded-full border border-border/50 bg-background/95 px-4 py-2.5 text-xs font-bold text-muted-foreground"><AlertCircle className="h-4 w-4" />Excluded from assessment</div>
      {!readonly && <Button variant="outline" size="sm" onClick={() => onChange({ score: null })} className="h-8 gap-2 bg-background text-xs font-bold"><Undo2 className="h-3.5 w-3.5" />Include back</Button>}
    </div>
  );

  return (
    <div className={cn("group min-w-0 rounded-xl border bg-card transition-all duration-200", statusColor, isExcluded && "opacity-75 grayscale-[0.5]", expanded ? "shadow-md ring-1 ring-primary/5" : "hover:shadow-sm")}>
      <div
        className={cn("flex w-full items-center justify-between gap-4 px-4 py-3.5", !alwaysExpanded && "cursor-pointer outline-none")}
        role={alwaysExpanded ? undefined : "button"}
        tabIndex={alwaysExpanded ? undefined : 0}
        onClick={alwaysExpanded ? undefined : () => setIsExpanded((current) => !current)}
        onKeyDown={alwaysExpanded ? undefined : (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded((current) => !current);
          }
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-mono font-bold", isComplete ? isExcluded ? "bg-muted text-muted-foreground" : "bg-success-soft text-success" : "bg-primary/10 text-primary")}>
            {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={cn("truncate text-sm font-bold transition-colors", isComplete ? "text-foreground" : "text-foreground/80 group-hover:text-primary")}>{indicator.name}</h4>
            {!expanded && indicator.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{indicator.description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {indicator.score !== null && <div className={cn("rounded-md border px-3 py-1 font-mono text-xs font-black shadow-sm", indicator.score === "X" && "border-border bg-muted text-muted-foreground", indicator.score === 1 && "border-destructive/20 bg-destructive/10 text-destructive", indicator.score === 2 && "border-warning/40 bg-warning-soft text-warning-foreground", indicator.score === 3 && "border-success/40 bg-success-soft text-success", indicator.score === 4 && "border-primary bg-primary text-primary-foreground")}>{indicator.score === "X" ? "N/A" : indicator.score.toFixed(1)}</div>}
          {!alwaysExpanded && (expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/50" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/50" />)}
        </div>
      </div>

      {expanded && (
        <div className="space-y-5 border-t border-border/50 px-4 pb-5 pt-4">
          <div className={cn("transition-opacity", isExcluded && "select-none opacity-40")}>
            {alwaysExpanded ? (
              <ScoreSelector value={indicator.score} onChange={(score) => onChange({ score })} disabled={readonly || isExcluded} rubricDescriptions={rubricDescriptions} compact />
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Info className="h-4 w-4 text-primary" />Performance rating</div>
                <ScoreSelector value={indicator.score} onChange={(score) => onChange({ score })} disabled={readonly || isExcluded} rubricDescriptions={rubricDescriptions} />
              </>
            )}
          </div>

          {alwaysExpanded ? (
            <div className="relative">
              {excludedOverlay}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSupportOpen((current) => !current)}
                aria-expanded={supportOpen}
              >
                <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Evidence & guidance{evidenceRequired && <span className="text-destructive">required</span>}</span>
                {supportOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {supportOpen && <div className="mt-4 space-y-5">{measurementAndGuidance}{evidenceInput}{indicator.trainings && !isExcluded && <TrainingPanel trainings={indicator.trainings} />}</div>}
              {evidenceRequired && !supportOpen && <p className="mt-2 text-xs text-destructive">Evidence is required for this rating.</p>}
            </div>
          ) : (
            <div className="relative space-y-6">
              {excludedOverlay}
              {measurementAndGuidance}
              {evidenceInput}
              {indicator.trainings && !isExcluded && <TrainingPanel trainings={indicator.trainings} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrainingPanel({ trainings }: { trainings: string }) {
  return <div className="rounded-lg border border-success/40 bg-success-soft p-3"><div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-success"><ShieldCheck className="h-3.5 w-3.5" />Recommended trainings</div><p className="text-sm text-success">{trainings}</p></div>;
}

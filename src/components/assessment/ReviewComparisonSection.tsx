import { cn } from "@/lib/utils";
import { ReviewComparisonIndicator, ReviewIndicatorData } from "./ReviewComparisonIndicator";
import { Percent, Target } from "lucide-react";
import { KPIData } from "@/hooks/useAssessment";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface ReviewStandardData {
  id: string;
  name: string;
  kpis: ReviewIndicatorData[];
}

export interface DomainReviewData {
  id: string;
  name: string;
  weight: number;
  standards: ReviewStandardData[];
}

function average(domain: DomainReviewData, type: "staff" | "manager" | "director") {
  const scores = domain.standards.flatMap((standard) => standard.kpis)
    .map((kpi) => type === "staff" ? kpi.staffScore : type === "manager" ? kpi.managerScore : (kpi.directorScore ?? kpi.managerScore))
    .filter((score): score is number => typeof score === "number");
  return scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
}

interface ReviewComparisonSectionProps {
  section: DomainReviewData;
  onIndicatorChange?: (indicatorId: string, updates: Partial<KPIData>) => void;
  readonly?: boolean;
  reviewerLabel?: string;
  index?: number;
  managerOnly?: boolean;
  directorMode?: boolean;
  showDirectorComparison?: boolean;
}

export function ReviewComparisonSection({ section, onIndicatorChange, readonly, reviewerLabel = "Manager", index, managerOnly = false, directorMode = false, showDirectorComparison = false }: ReviewComparisonSectionProps) {
  const managerScore = average(section, "manager");
  const directorScore = average(section, "director");
  const totalKPIs = section.standards.reduce((total, standard) => total + standard.kpis.length, 0);

  return (
    <AccordionItem value={section.id} className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm transition-all data-[state=open]:shadow-md">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/40">
        <div className="flex flex-1 items-center gap-3 text-left">
          <div className="flex min-w-12 flex-col items-center rounded-lg border border-primary/20 bg-primary/10 p-1.5 text-primary">
            <span className="text-xs font-black">{index === undefined ? <Percent className="h-4 w-4" /> : `P${index + 1}`}</span>
            <span className="font-mono text-[10px] font-bold">{section.weight}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold sm:text-lg">{section.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Target className="h-3 w-3" />{totalKPIs} performance items</p>
          </div>
          <div className="mr-3 hidden items-center gap-4 sm:flex">
            {managerScore !== null && <div className="text-right"><p className="font-mono text-lg font-black text-primary">{managerScore.toFixed(2)}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Manager</p></div>}
            {(directorMode || showDirectorComparison) && directorScore !== null && <div className="text-right"><p className={cn("font-mono text-lg font-black", directorScore !== managerScore && "text-warning-foreground")}>{directorScore.toFixed(2)}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Director</p></div>}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t px-4 pb-5 pt-4">
        <div className="space-y-5">
          {section.standards.map((standard) => (
            <div key={standard.id} className="space-y-2">
              <h4 className="border-b pb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{standard.name}</h4>
              <div className="space-y-2">
                {standard.kpis.map((indicator, itemIndex) => (
                  <ReviewComparisonIndicator
                    key={indicator.id}
                    indicator={indicator}
                    index={itemIndex}
                    onScoreChange={(score) => onIndicatorChange?.(indicator.id, directorMode ? { directorScore: score } : { managerScore: score })}
                    onEvidenceChange={(evidence) => onIndicatorChange?.(indicator.id, directorMode ? { directorEvidence: evidence } : { managerEvidence: evidence })}
                    readonly={readonly}
                    reviewerLabel={reviewerLabel}
                    managerOnly={managerOnly}
                    directorMode={directorMode}
                    showDirectorComparison={showDirectorComparison}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

import { cn } from "@/lib/utils";
import { ReviewComparisonIndicator, ReviewIndicatorData } from "./ReviewComparisonIndicator";
import { Percent, Target, Layers } from "lucide-react";
import { KPIData } from "@/hooks/useAssessment";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

function calculateDomainReviewScore(domain: DomainReviewData, type: 'staff' | 'manager'): number | null {
  let allKPIs: ReviewIndicatorData[] = [];
  domain.standards.forEach(s => {
    allKPIs = [...allKPIs, ...s.kpis];
  });

  const scores = allKPIs
    .map(k => type === 'staff' ? k.staffScore : k.managerScore)
    .filter((s): s is number => s !== null && s !== 'X');

  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + Number(b), 0) / scores.length;
}

interface ReviewComparisonSectionProps {
  section: DomainReviewData;
  onIndicatorChange?: (indicatorId: string, updates: Partial<KPIData>) => void;
  readonly?: boolean;
  reviewerLabel?: string;
  index?: number;
}

export function ReviewComparisonSection({ section, onIndicatorChange, readonly, reviewerLabel = "Manager", index }: ReviewComparisonSectionProps) {
  const staffScore = calculateDomainReviewScore(section, 'staff');
  const managerScore = calculateDomainReviewScore(section, 'manager');

  let totalKPIs = 0;
  section.standards.forEach(s => totalKPIs += s.kpis.length);

  return (
    <AccordionItem value={section.id} className="bg-card border rounded-xl overflow-hidden shadow-sm mb-4 data-[state=open]:shadow-md transition-all duration-300">
      {/* Domain Header */}
      <AccordionTrigger className="px-6 py-5 bg-secondary/10 hover:bg-secondary/20 border-b flex items-center justify-between hover:no-underline transition-colors">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 min-w-[60px]">
            {index !== undefined ? (
              <span className="font-black text-sm">D{index + 1}</span>
            ) : (
              <Percent className="h-4 w-4 mb-0.5" />
            )}
            <span className="font-mono font-bold text-[10px] leading-tight mt-0.5">{section.weight}%</span>
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-foreground">{section.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                {totalKPIs} KPIs
              </p>
              <span className="text-muted-foreground opacity-20">|</span>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {section.standards.length} Standards
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 mr-4">
          {/* Staff Score */}
          {staffScore !== null && (
            <div className="text-right hidden sm:block">
              <div className={cn(
                "text-xl font-mono font-bold",
                staffScore < 2 && "text-evidence-alert",
                staffScore >= 2 && staffScore < 3 && "text-amber-500",
                staffScore >= 3 && "text-evidence-success"
              )}>
                {staffScore.toFixed(2)}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Self</div>
            </div>
          )}

          {/* Manager Score */}
          {managerScore !== null && (
            <div className="text-right hidden sm:block">
              <div className={cn(
                "text-2xl font-mono font-black text-primary",
              )}>
                {managerScore.toFixed(2)}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-primary/70">{reviewerLabel}</div>
            </div>
          )}
        </div>
      </AccordionTrigger>

      {/* Standards and KPIs */}
      <AccordionContent className="pt-0 pb-6 px-6 border-t border-border/50">
        <div className="space-y-8 pt-6">
          {section.standards.map((standard, stdIdx) => (
            <div key={standard.id} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">
                  S{stdIdx + 1}
                </div>
                <h4 className="font-bold text-sm text-foreground uppercase tracking-wide italic">{standard.name}</h4>
              </div>

              <div className="space-y-4 pl-4 border-l-2 border-muted/50">
                {standard.kpis.map((indicator, index) => (
                  <ReviewComparisonIndicator
                    key={indicator.id}
                    indicator={indicator}
                    index={index}
                    onScoreChange={(score) => onIndicatorChange?.(indicator.id, { managerScore: score })}
                    onEvidenceChange={(evidence) => onIndicatorChange?.(indicator.id, { managerEvidence: evidence })}
                    readonly={readonly}
                    reviewerLabel={`${reviewerLabel} Review`}
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

import { cn } from "@/lib/utils";
import { AssessmentIndicator, KPIData } from "./AssessmentIndicator";
import { EvidenceItem } from "./EvidenceInput";
import { Percent, Target, Layers, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface StandardData {
  id: string;
  name: string;
  kpis: KPIData[];
}

export interface DomainData {
  id: string;
  name: string;
  weight: number;
  standards: StandardData[];
}

function hasValidEvidence(evidence: string | EvidenceItem[]): boolean {
  if (Array.isArray(evidence)) {
    return evidence.some(e => e.evidence.trim().length > 0);
  }
  return typeof evidence === 'string' && evidence.trim().length > 0;
}

interface AssessmentSectionProps {
  section: DomainData;
  onIndicatorChange: (indicatorId: string, updates: Partial<KPIData>) => void;
  readonly?: boolean;
}

function calculateDomainScore(domain: DomainData): number | null {
  let allKPIs: KPIData[] = [];
  domain.standards.forEach(s => {
    allKPIs = [...allKPIs, ...s.kpis];
  });

  const scoredKPIs = allKPIs.filter(k => k.score !== null && k.score !== 'X');
  if (scoredKPIs.length === 0) return null;

  const sum = scoredKPIs.reduce((acc, k) => acc + (Number(k.score) || 0), 0);
  return sum / scoredKPIs.length;
}

export function AssessmentSection({ section, onIndicatorChange, readonly = false }: AssessmentSectionProps) {
  const domainScore = calculateDomainScore(section);

  let totalKPIs = 0;
  let completedKPIs = 0;

  section.standards.forEach(s => {
    s.kpis.forEach(k => {
      totalKPIs++;
      if (k.score !== null && (k.score === 'X' || hasValidEvidence(k.evidence))) {
        completedKPIs++;
      }
    });
  });

  const progressPercentage = Math.round((completedKPIs / totalKPIs) * 100);
  const isComplete = completedKPIs === totalKPIs;

  return (
    <AccordionItem value={section.id} className="border rounded-xl bg-card shadow-sm overflow-hidden mb-4 data-[state=open]:shadow-md transition-all duration-300">
      <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-muted/50 transition-colors [&[data-state=open]]:bg-primary/5">
        <div className="flex items-center gap-4 flex-1 text-left w-full">
          {/* Weight Badge */}
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 min-w-[60px]">
            <Percent className="h-4 w-4 mb-0.5" />
            <span className="font-mono font-bold text-sm">{section.weight}%</span>
          </div>

          {/* Title & Stats */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-foreground">{section.name}</h3>
              {isComplete && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                  Complete
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1.5">
              {/* Progress Bar */}
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      isComplete ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-muted-foreground min-w-[35px]">{progressPercentage}%</span>
              </div>

              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {completedKPIs}/{totalKPIs} KPIs
                </span>
                <span className="opacity-20">|</span>
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {section.standards.length} Standards
                </span>
              </div>
            </div>
          </div>

          {/* Score Badge (if available) */}
          {domainScore !== null && (
            <div className="text-right mr-4 hidden sm:block">
              <div className={cn(
                "text-2xl font-mono font-black",
                domainScore < 2 && "text-destructive",
                domainScore >= 2 && domainScore < 3 && "text-amber-500",
                domainScore >= 3 && "text-emerald-600"
              )}>
                {domainScore.toFixed(2)}
              </div>
              <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/70">Score</div>
            </div>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="pt-0 pb-6 px-6 border-t border-border/50">
        <div className="space-y-10 pt-6">
          {section.standards.map((standard, stdIdx) => (
            <div key={standard.id} className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-black text-muted-foreground/70 uppercase">
                  S{stdIdx + 1}
                </div>
                <h4 className="font-bold text-base text-foreground/90 uppercase tracking-wide">{standard.name}</h4>
              </div>

              <div className="grid gap-4 pl-2 lg:pl-4">
                {standard.kpis.map((kpi, kpiIdx) => (
                  <AssessmentIndicator
                    key={kpi.id}
                    indicator={kpi}
                    index={kpiIdx}
                    onChange={(updates) => onIndicatorChange(kpi.id, updates)}
                    readonly={readonly}
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

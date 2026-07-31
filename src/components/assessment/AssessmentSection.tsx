import { cn } from "@/lib/utils";
import { AssessmentIndicator, KPIData } from "./AssessmentIndicator";
import { EvidenceItem } from "./EvidenceInput";
import { Percent, Target, Layers } from "lucide-react";
import {
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
    return evidence.some((entry) => entry.evidence.trim().length > 0);
  }
  return typeof evidence === "string" && evidence.trim().length > 0;
}

interface AssessmentSectionProps {
  section: DomainData;
  onIndicatorChange: (indicatorId: string, updates: Partial<KPIData>) => void;
  readonly?: boolean;
  evidenceRequiredAtOrAbove?: number;
  alwaysExpanded?: boolean;
}

function calculateDomainScore(domain: DomainData): number | null {
  const allKPIs = domain.standards.flatMap((standard) => standard.kpis);
  const scoredKPIs = allKPIs.filter((kpi) => kpi.score !== null && kpi.score !== "X");
  if (scoredKPIs.length === 0) return null;

  return scoredKPIs.reduce((total, kpi) => total + (Number(kpi.score) || 0), 0) / scoredKPIs.length;
}

function SectionHeader({
  section,
  completedKPIs,
  totalKPIs,
  progressPercentage,
  domainScore,
}: {
  section: DomainData;
  completedKPIs: number;
  totalKPIs: number;
  progressPercentage: number;
  domainScore: number | null;
}) {
  const isComplete = completedKPIs === totalKPIs;

  return (
    <div className="flex w-full items-center gap-4 text-left">
      <div className="flex min-w-[60px] flex-col items-center justify-center rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
        <Percent className="mb-0.5 h-4 w-4" />
        <span className="font-mono text-sm font-bold">{section.weight}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold text-foreground">{section.name}</h3>
          {isComplete && (
            <span className="rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
              Complete
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-4">
          <div className="flex max-w-[200px] flex-1 items-center gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-500", isComplete ? "bg-success" : "bg-primary")}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="min-w-[35px] font-mono text-xs font-bold text-muted-foreground">{progressPercentage}%</span>
          </div>
          <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1"><Target className="h-3 w-3" />{completedKPIs}/{totalKPIs} KPIs</span>
            <span className="opacity-20">|</span>
            <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{section.standards.length} Standards</span>
          </div>
        </div>
      </div>
      {domainScore !== null && (
        <div className={cn(
          "mr-4 hidden text-right sm:block",
          domainScore < 2 ? "text-destructive" : domainScore < 3 ? "text-warning-foreground" : "text-success",
        )}>
          <div className="font-mono text-2xl font-black">{domainScore.toFixed(2)}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Score</div>
        </div>
      )}
    </div>
  );
}

function SectionContent({
  section,
  onIndicatorChange,
  readonly,
  evidenceRequiredAtOrAbove,
  alwaysExpanded,
}: AssessmentSectionProps) {
  return (
    <div className="space-y-10 pt-6">
      {section.standards.map((standard, standardIndex) => (
        <div key={standard.id} className="space-y-5">
          <div className="flex items-center gap-3 border-b border-border/50 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-black uppercase text-muted-foreground/70">S{standardIndex + 1}</div>
            <h4 className="text-base font-bold uppercase tracking-wide text-foreground/90">{standard.name}</h4>
          </div>
          <div className="grid gap-4 pl-2 lg:pl-4">
            {standard.kpis.map((kpi, kpiIndex) => (
              <AssessmentIndicator
                key={kpi.id}
                indicator={kpi}
                index={kpiIndex}
                onChange={(updates) => onIndicatorChange(kpi.id, updates)}
                readonly={readonly}
                evidenceRequiredAtOrAbove={evidenceRequiredAtOrAbove}
                alwaysExpanded={alwaysExpanded}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AssessmentSection({
  section,
  onIndicatorChange,
  readonly = false,
  evidenceRequiredAtOrAbove = 1,
  alwaysExpanded = false,
}: AssessmentSectionProps) {
  const domainScore = calculateDomainScore(section);
  const allKPIs = section.standards.flatMap((standard) => standard.kpis);
  const completedKPIs = allKPIs.filter((kpi) =>
    kpi.score !== null && (kpi.score === "X" || (typeof kpi.score === "number" && (kpi.score < evidenceRequiredAtOrAbove || hasValidEvidence(kpi.evidence)))),
  ).length;
  const totalKPIs = allKPIs.length;
  const progressPercentage = totalKPIs === 0 ? 0 : Math.round((completedKPIs / totalKPIs) * 100);
  const contentProps = { section, onIndicatorChange, readonly, evidenceRequiredAtOrAbove, alwaysExpanded };
  const headerProps = { section, completedKPIs, totalKPIs, progressPercentage, domainScore };

  if (alwaysExpanded) {
    return (
      <section className="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border/50 bg-primary/5 px-6 py-5">
          <SectionHeader {...headerProps} />
        </div>
        <div className="px-6 pb-6"><SectionContent {...contentProps} /></div>
      </section>
    );
  }

  return (
    <AccordionItem value={section.id} className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 data-[state=open]:shadow-md">
      <AccordionTrigger className="px-6 py-5 transition-colors hover:bg-muted/50 hover:no-underline [&[data-state=open]]:bg-primary/5">
        <SectionHeader {...headerProps} />
      </AccordionTrigger>
      <AccordionContent className="border-t border-border/50 px-6 pb-6 pt-0">
        <SectionContent {...contentProps} />
      </AccordionContent>
    </AccordionItem>
  );
}

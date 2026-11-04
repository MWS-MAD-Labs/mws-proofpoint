"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AssessmentSection,
  WeightedScoreDisplay,
  type KPIData,
} from "@/components/assessment";
import { Accordion } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateWeightedScore } from "@/hooks/useAssessment";
import {
  BookOpen,
  Eye,
  Info,
  RotateCcw,
  Target,
} from "lucide-react";
import {
  applyKpiPreviewUpdate,
  buildKpiPreviewDomains,
  type RawKpiTemplateInput,
} from "./rubric-preview-utils";

interface KpiRubricPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RawKpiTemplateInput | null;
}

export function KpiRubricPreviewDialog({
  open,
  onOpenChange,
  template,
}: KpiRubricPreviewDialogProps) {
  const [responses, setResponses] = useState<
    Record<string, { score: number | "X" | null; evidence: KPIData["evidence"] }>
  >({});
  const [openDomains, setOpenDomains] = useState<string[]>([]);

  // Reset trial responses when switching to a different template ID
  useEffect(() => {
    setResponses({});
  }, [template?.id]);

  const domains = useMemo(
    () => buildKpiPreviewDomains(template, responses),
    [template, responses],
  );

  useEffect(() => {
    if (open) {
      setOpenDomains(domains.map((d) => d.id));
    }
  }, [open, domains.length, template?.id]);

  const handleIndicatorChange = (kpiId: string, updates: Partial<KPIData>) => {
    setResponses((prev) => {
      const current = prev[kpiId] ?? { score: null, evidence: "" };
      const updatedDomains = applyKpiPreviewUpdate(domains, kpiId, updates);
      let updatedKpi: KPIData | undefined;
      for (const d of updatedDomains) {
        for (const s of d.standards) {
          const found = s.kpis.find((k) => k.id === kpiId);
          if (found) {
            updatedKpi = found;
            break;
          }
        }
      }
      return {
        ...prev,
        [kpiId]: {
          score: updatedKpi ? updatedKpi.score : current.score,
          evidence: updatedKpi ? updatedKpi.evidence : current.evidence,
        },
      };
    });
  };

  const handleReset = () => {
    setResponses({});
  };

  const weightedScore = useMemo(
    () => calculateWeightedScore(domains, "staff"),
    [domains],
  );

  const { totalKPIs, completedKPIs } = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const d of domains) {
      for (const s of d.standards) {
        for (const k of s.kpis) {
          total++;
          const hasEvidence = Array.isArray(k.evidence)
            ? k.evidence.some((e) => e.evidence.trim().length > 0)
            : typeof k.evidence === "string" && k.evidence.trim().length > 0;
          if (k.score !== null && (k.score === "X" || hasEvidence)) {
            completed++;
          }
        }
      }
    }
    return { totalKPIs: total, completedKPIs: completed };
  }, [domains]);

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
                  Preview as Staff / Appraisee
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {completedKPIs}/{totalKPIs} KPIs Completed
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold">
                {template.name?.trim() || "Untitled Rubric Template"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {template.description?.trim() ||
                  "KPI-Based Self-Assessment & Staff Appraisal Fill-In Preview"}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
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
              Click any KPI indicator below to expand its measurement criteria, test selecting a 1–4 performance rating (or N/A exclusion), add sample evidence links, and see how the projected weighted score updates.
            </AlertDescription>
          </Alert>

          {domains.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No domains or KPIs to preview yet.</p>
                <p className="text-xs mt-1">
                  Add at least one domain, standard, and KPI in the editor to test filling in this rubric.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-4">
                <Accordion
                  type="multiple"
                  value={openDomains}
                  onValueChange={setOpenDomains}
                  className="w-full space-y-4"
                >
                  {domains.map((domain) => (
                    <AssessmentSection
                      key={domain.id}
                      section={domain}
                      onIndicatorChange={handleIndicatorChange}
                      readonly={false}
                    />
                  ))}
                </Accordion>
              </div>

              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-2">
                <WeightedScoreDisplay
                  domains={domains}
                  score={weightedScore}
                  label="Projected Score"
                  type="staff"
                  showAlways={true}
                />

                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        Trial Completion
                      </span>
                      <span className="font-mono">
                        {completedKPIs} / {totalKPIs} KPIs
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Each KPI is marked complete when a rating (1–4) and at least one evidence item are filled in, or when marked N/A.
                    </p>
                  </CardContent>
                </Card>
              </div>
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

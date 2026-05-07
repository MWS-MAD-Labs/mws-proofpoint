import { cn } from "@/lib/utils";
import { DomainData, KPIData } from "@/hooks/useAssessment";
import { EvidenceItem } from "./EvidenceInput";
import { TrendingUp, Award, AlertTriangle, Lock } from "lucide-react";

interface ScoreComparisonWidgetProps {
    domains?: DomainData[];
    finalScore?: number | null;
    projectedScore?: number | null;
}

function hasValidEvidence(evidence: string | EvidenceItem[]): boolean {
    if (Array.isArray(evidence)) {
        return evidence.some(e => e.evidence.trim().length > 0);
    }
    return typeof evidence === 'string' && evidence.trim().length > 0;
}

function calculateWeightedScore(domains: DomainData[] | undefined | null, type: 'staff' | 'manager' = 'staff'): number | null {
    if (!domains || !Array.isArray(domains)) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const domain of domains) {
        let allKPIs: KPIData[] = [];
        domain.standards.forEach(s => {
            allKPIs = [...allKPIs, ...s.kpis];
        });

        const scoredKPIs = allKPIs.filter(k => {
            const s = type === 'staff' ? k.score : k.managerScore;
            return s !== null && s !== undefined && s !== 'X';
        });

        if (scoredKPIs.length === 0) continue;

        const domainAvg = scoredKPIs.reduce((acc, k) => {
            const s = type === 'staff' ? k.score : k.managerScore;
            return acc + (Number(s) || 0);
        }, 0) / scoredKPIs.length;

        weightedSum += domainAvg * domain.weight;
        totalWeight += domain.weight;
    }

    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
}

function getLetterGrade(score: number): { grade: string; label: string; description: string; bonusPayout: number } {
    if (score >= 3.9) return {
        grade: "★",
        label: "Exemplary",
        description: "Outstanding performance that exceeds expectations across all domains.",
        bonusPayout: 100
    };
    if (score >= 3.6) return {
        grade: "◆",
        label: "Trail Blazers",
        description: "High-performing individuals who go beyond role expectations.",
        bonusPayout: 90
    };
    if (score >= 3.4) return {
        grade: "▲",
        label: "Rising Star",
        description: "Employees showing significant growth and potential.",
        bonusPayout: 80
    };
    if (score >= 3.2) return {
        grade: "●",
        label: "Solid Foundation",
        description: "Reliably meets role expectations.",
        bonusPayout: 65
    };
    if (score >= 3.0) return {
        grade: "◐",
        label: "Developing",
        description: "Entry level grade, expected to progress.",
        bonusPayout: 50
    };
    if (score >= 2.8) return {
        grade: "○",
        label: "Needs Improvement",
        description: "Improvement required within defined period.",
        bonusPayout: 40
    };
    return {
        grade: "!",
        label: "Performance Management",
        description: "Immediate intervention required.",
        bonusPayout: 10
    };
}

export function ScoreComparisonWidget({ domains, finalScore, projectedScore }: ScoreComparisonWidgetProps) {
    const calculatedFinal = calculateWeightedScore(domains, 'manager');
    const calculatedProjected = calculateWeightedScore(domains, 'staff');

    const finalWeighted = finalScore !== undefined && finalScore !== null ? finalScore : calculatedFinal;
    const projectedWeighted = projectedScore !== undefined && projectedScore !== null ? projectedScore : calculatedProjected;

    const finalGrade = finalWeighted !== null ? getLetterGrade(finalWeighted) : null;
    const projectedGrade = projectedWeighted !== null ? getLetterGrade(projectedWeighted) : null;

    // Calculate completion for manager review
    const hasDomains = domains && Array.isArray(domains) && domains.length > 0;
    let totalKPIs = 0;
    let completedKPIs = 0;

    if (hasDomains) {
        domains!.forEach(d => {
            d.standards.forEach(s => {
                s.kpis.forEach(k => {
                    totalKPIs++;
                    // Auto-count as covered if staff score is 'X' OR manager has reviewed
                    if (k.score === 'X' || (k.managerScore !== null && k.managerScore !== undefined)) {
                        completedKPIs++;
                    }
                });
            });
        });
    }

    const completionPercent = totalKPIs > 0 ? (completedKPIs / totalKPIs) * 100 : 0;

    // Calculate domain averages
    const domainAverages = hasDomains ? domains!.map(domain => {
        let domainKPIs: KPIData[] = [];
        domain.standards.forEach(s => {
            domainKPIs = [...domainKPIs, ...s.kpis];
        });

        const staffScoredKPIs = domainKPIs.filter(k => k.score !== null && k.score !== undefined && k.score !== 'X');
        const managerScoredKPIs = domainKPIs.filter(k => k.managerScore !== null && k.managerScore !== undefined && k.managerScore !== 'X');

        const staffAvg = staffScoredKPIs.length > 0
            ? staffScoredKPIs.reduce((a, k) => a + (Number(k.score) || 0), 0) / staffScoredKPIs.length
            : null;

        const managerAvg = managerScoredKPIs.length > 0
            ? managerScoredKPIs.reduce((a, k) => a + (Number(k.managerScore) || 0), 0) / managerScoredKPIs.length
            : null;

        return { name: domain.name, staffAvg, managerAvg };
    }) : [];

    const getScoreColor = (score: number | null) => {
        if (score === null) return "text-muted-foreground/30";
        if (score < 2) return "text-evidence-alert";
        if (score < 3) return "text-amber-500";
        return "text-evidence-success";
    };

    const getIcon = (score: number | null) => {
        if (score === null) return Lock;
        if (score >= 3) return Award;
        if (score >= 2) return TrendingUp;
        return AlertTriangle;
    };

    const FinalIcon = getIcon(finalWeighted);
    const ProjectedIcon = getIcon(projectedWeighted);

    return (
        <div className="bg-card border rounded-xl overflow-hidden shadow-md">
            {/* Header Row: Score Comparison */}
            <div className="grid grid-cols-2 divide-x border-b">
                {/* Final Score Column */}
                <div className="p-4 text-center bg-gradient-to-b from-muted/30 to-background">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                        <FinalIcon className={cn("h-4 w-4", getScoreColor(finalWeighted))} />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                            Final Score
                        </span>
                    </div>
                    <div className={cn("text-3xl font-mono font-black tracking-tighter", getScoreColor(finalWeighted))}>
                        {finalWeighted !== null ? finalWeighted.toFixed(2) : "—.——"}
                    </div>
                    {finalGrade && (
                        <div className="mt-2">
                            <span className={cn(
                                "text-lg font-bold px-2 py-0.5 rounded bg-background border shadow-sm",
                                getScoreColor(finalWeighted)
                            )}>
                                {finalGrade.grade}
                            </span>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                {finalGrade.label}
                            </div>
                        </div>
                    )}
                </div>

                {/* Projected Score Column */}
                <div className="p-4 text-center bg-gradient-to-b from-muted/30 to-background">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                        <ProjectedIcon className={cn("h-4 w-4", getScoreColor(projectedWeighted))} />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                            Projected
                        </span>
                    </div>
                    <div className={cn("text-3xl font-mono font-black tracking-tighter", getScoreColor(projectedWeighted))}>
                        {projectedWeighted !== null ? projectedWeighted.toFixed(2) : "—.——"}
                    </div>
                    {projectedGrade && (
                        <div className="mt-2">
                            <span className={cn(
                                "text-lg font-bold px-2 py-0.5 rounded bg-background border shadow-sm",
                                getScoreColor(projectedWeighted)
                            )}>
                                {projectedGrade.grade}
                            </span>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                {projectedGrade.label}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Description Row */}
            {(finalGrade || projectedGrade) && (
                <div className="grid grid-cols-2 divide-x border-b text-[10px] text-muted-foreground leading-snug">
                    <div className="p-3">
                        {finalGrade?.description || <span className="italic opacity-50">Complete review to see tier</span>}
                    </div>
                    <div className="p-3">
                        {projectedGrade?.description || <span className="italic opacity-50">—</span>}
                    </div>
                </div>
            )}

            {/* Framework Coverage (Review Progress) */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Framework Coverage</span>
                    <span className="text-sm font-mono font-bold">
                        {completedKPIs}/{totalKPIs}
                    </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden border">
                    <div
                        className={cn(
                            "h-full transition-all duration-700 rounded-full",
                            completionPercent < 50 && "bg-evidence-alert",
                            completionPercent >= 50 && completionPercent < 100 && "bg-amber-400",
                            completionPercent === 100 && "bg-evidence-success"
                        )}
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
                {completionPercent < 100 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                        {totalKPIs - completedKPIs} KPIs remaining to complete review
                    </p>
                )}
            </div>

            {/* Domain Averages Comparison */}
            {hasDomains && (
                <div className="px-4 py-3 space-y-1.5">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center justify-between">
                        <span>Domain Averages</span>
                        <div className="flex gap-4 text-[9px]">
                            <span>Final</span>
                            <span>Projected</span>
                        </div>
                    </div>
                    {domainAverages.map((domain, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm group">
                            <span className="text-muted-foreground truncate flex-1 mr-2 text-xs" title={domain.name}>
                                {domain.name}
                            </span>
                            <div className="flex gap-4 items-center">
                                {domain.managerAvg !== null ? (
                                    <span className={cn(
                                        "font-mono font-bold text-sm min-w-[2.5rem] text-right",
                                        getScoreColor(domain.managerAvg)
                                    )}>
                                        {domain.managerAvg.toFixed(1)}
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-muted-foreground/30 uppercase min-w-[2.5rem] text-right">—</span>
                                )}
                                {domain.staffAvg !== null ? (
                                    <span className={cn(
                                        "font-mono font-bold text-sm min-w-[2.5rem] text-right",
                                        getScoreColor(domain.staffAvg)
                                    )}>
                                        {domain.staffAvg.toFixed(1)}
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-muted-foreground/30 uppercase min-w-[2.5rem] text-right">—</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Final Bonus Payout */}
            {finalGrade && (
                <div className="p-4 border-t bg-gradient-to-r from-emerald-500/5 to-emerald-500/10">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Final Bonus Payout</span>
                        <span className={cn(
                            "text-2xl font-mono font-black",
                            finalGrade.bonusPayout >= 80 && "text-evidence-success",
                            finalGrade.bonusPayout >= 50 && finalGrade.bonusPayout < 80 && "text-amber-500",
                            finalGrade.bonusPayout < 50 && "text-evidence-alert"
                        )}>
                            {finalGrade.bonusPayout}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

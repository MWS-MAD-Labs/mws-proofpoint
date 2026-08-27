import { Assessment, calculateWeightedScore, DomainData, KPIData } from "@/hooks/useAssessment";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ProofPointMark } from "@/components/ProofPointMark";

interface AssessmentPrintViewProps {
    assessment: Assessment;
    domains: DomainData[];
    staffName?: string;
}

// Tier logic with bonus payout information
// IMPORTANT: These values must stay aligned with getLetterGrade in WeightedScoreDisplay.tsx
function getPerformanceTier(score: number) {
    if (score >= 3.9) return {
        label: "Exemplary",
        grade: "★",
        color: "text-primary",
        bg: "bg-primary-soft",
        borderColor: "border-primary/40",
        description: "Outstanding performance that exceeds expectations across all domains.",
        bonus: "100%"
    };
    if (score >= 3.6) return {
        label: "Trail Blazers",
        grade: "◆",
        color: "text-primary",
        bg: "bg-primary-soft",
        borderColor: "border-primary/40",
        description: "High-performing individuals who go beyond role expectations.",
        bonus: "90%"
    };
    if (score >= 3.4) return {
        label: "Rising Star",
        grade: "▲",
        color: "text-primary",
        bg: "bg-primary-soft",
        borderColor: "border-primary/40",
        description: "Employees showing significant growth and potential.",
        bonus: "80%"
    };
    if (score >= 3.2) return {
        label: "Solid Foundation",
        grade: "●",
        color: "text-success",
        bg: "bg-success-soft",
        borderColor: "border-success/40",
        description: "Reliably meets role expectations.",
        bonus: "65%"
    };
    if (score >= 3.0) return {
        label: "Developing",
        grade: "◐",
        color: "text-success",
        bg: "bg-success-soft",
        borderColor: "border-success/40",
        description: "Entry level grade, expected to progress.",
        bonus: "50%"
    };
    if (score >= 2.8) return {
        label: "Needs Improvement",
        grade: "○",
        color: "text-warning-foreground",
        bg: "bg-warning-soft",
        borderColor: "border-warning/40",
        description: "Improvement required within defined period.",
        bonus: "40%"
    };
    if (score >= 2.6) return {
        label: "Performance Management",
        grade: "!",
        color: "text-destructive",
        bg: "bg-destructive-soft",
        borderColor: "border-destructive/40",
        description: "Immediate intervention required.",
        bonus: "10%"
    };
    return {
        label: "Below Threshold",
        grade: "—",
        color: "text-destructive",
        bg: "bg-destructive-soft",
        borderColor: "border-destructive/40",
        description: "Performance is critically below acceptable standards.",
        bonus: "0%"
    };
}

export function AssessmentPrintView({ assessment, domains, staffName }: AssessmentPrintViewProps) {
    const isDirectSelfAssessment =
        !assessment.permissions?.isManagerLed &&
        assessment.manager_id === null;
    const printDomains = isDirectSelfAssessment
        ? domains.map((domain) => ({
            ...domain,
            standards: domain.standards.map((standard) => ({
                ...standard,
                kpis: standard.kpis.map((kpi) => ({
                    ...kpi,
                    managerScore: kpi.directorScore ?? kpi.score,
                })),
            })),
        }))
        : domains;
    const calculatedScore = calculateWeightedScore(printDomains, 'manager');
    const managerScore = assessment.final_score !== null && assessment.final_score !== undefined
        ? Number(assessment.final_score)
        : (calculatedScore ?? 0);
    const tier = getPerformanceTier(managerScore);

    // Calculate domain averages with the same item weights used by the assessment score.
    const domainScores = printDomains.map((domain, idx) => {
        const allKPIs: KPIData[] = domain.standards.flatMap((standard) => standard.kpis);
        const scoredKPIs = allKPIs.filter(k => k.managerScore !== null && k.managerScore !== undefined && k.managerScore !== 'X');
        const itemWeightTotal = scoredKPIs.reduce(
            (total, kpi) => total + Number(kpi.performanceWeight ?? 100),
            0,
        );
        const avg = scoredKPIs.length > 0
            ? scoredKPIs.reduce(
                (total, kpi) => total + Number(kpi.managerScore) * Number(kpi.performanceWeight ?? 100),
                0,
            ) / (itemWeightTotal || scoredKPIs.length)
            : null;
        return {
            ...domain,
            code: `D${idx + 1}`,
            avgScore: avg,
            tier: avg !== null ? getPerformanceTier(avg) : null
        };
    });

    const displayName = staffName || assessment.staff_name || "Staff Member";
    const displayTitle = assessment.staff_job_title || "Position Not Set";

    return (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-white font-sans text-[10px] leading-tight text-foreground print:static print:overflow-visible print:p-0">
            {/* ===== HEADER ===== */}
            <div className="bg-primary px-6 py-3 text-primary-foreground print:py-2">
                <div className="flex justify-between items-center max-w-[210mm] mx-auto">
                    <div className="flex items-center gap-4">
                        <ProofPointMark className="h-10 w-10 bg-white text-primary shadow-none" />
                        <div>
                            <h1 className="text-base font-black tracking-tight uppercase">Performance Report</h1>
                            <p className="text-muted-foreground text-[8px] font-medium tracking-widest uppercase">
                                Confidential • {format(new Date(), 'MMM d, yyyy')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-bold text-white tracking-wider uppercase">{assessment.period}</div>
                        <div className="text-[8px] font-mono text-muted-foreground">Ref: {assessment.id.substring(0, 8)}</div>
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="max-w-[210mm] mx-auto px-6 py-4 space-y-4">

                {/* Employee Info Row */}
                <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                        <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Employee</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-foreground leading-none">{displayName}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-sm text-muted-foreground italic">{displayTitle}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Department</div>
                        <div className="text-[10px] font-bold text-foreground">{assessment.staff_department || "General"}</div>
                    </div>
                </div>

                {/* ===== EXECUTIVE SUMMARY ===== */}
                <section className="avoid-break">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-0.5 w-4 bg-foreground"></div>
                        <h2 className="text-[9px] font-black uppercase tracking-widest text-foreground">Executive Summary</h2>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        {/* Score Card - Compact with description and bonus */}
                        <div className={cn("col-span-4 p-3 rounded-lg border", tier.bg, tier.borderColor)}>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className={cn("text-2xl font-black tracking-tighter", tier.color)}>
                                    {managerScore.toFixed(2)}
                                </span>
                                <span className={cn("text-lg", tier.color)}>{tier.grade}</span>
                            </div>
                            <div className={cn("text-[9px] font-bold uppercase tracking-wide mb-2", tier.color)}>
                                {tier.label}
                            </div>
                            <p className="text-[8px] text-muted-foreground leading-relaxed mb-2">
                                {tier.description}
                            </p>
                            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">Bonus Payout</span>
                                <span className={cn("text-[10px] font-black", tier.color)}>{tier.bonus}</span>
                            </div>
                        </div>

                        {/* Domain Breakdown Table */}
                        <div className="col-span-8">
                            <table className="w-full text-[9px]">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-1 font-bold text-muted-foreground uppercase tracking-wider">Domain</th>
                                        <th className="text-right py-1 font-bold text-muted-foreground uppercase tracking-wider w-16">Score</th>
                                        <th className="text-center py-1 font-bold text-muted-foreground uppercase tracking-wider w-24">Tier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {domainScores.map(domain => (
                                        <tr key={domain.id} className="border-b border-border">
                                            <td className="py-1.5">
                                                <span className="font-mono font-bold text-muted-foreground mr-2">{domain.code}</span>
                                                <span className="font-semibold text-foreground">{domain.name}</span>
                                            </td>
                                            <td className="text-right py-1.5">
                                                {domain.avgScore !== null ? (
                                                    <span className={cn("font-bold", domain.tier?.color)}>{domain.avgScore.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="text-center py-1.5">
                                                {domain.tier && (
                                                    <span className={cn("inline-flex items-center gap-1 text-[8px] font-medium", domain.tier.color)}>
                                                        <span>{domain.tier.grade}</span>
                                                        <span>{domain.tier.label}</span>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* ===== DETAILED FRAMEWORK BREAKDOWN ===== */}
                <section className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-0.5 w-4 bg-foreground"></div>
                        <h2 className="text-[9px] font-black uppercase tracking-widest text-foreground">Detailed Framework Breakdown</h2>
                    </div>

                    {domainScores.map((domain, domainIdx) => (
                        <div key={domain.id} className="avoid-break">
                            {/* Domain Header */}
                            <div className="bg-foreground text-white px-3 py-1.5 rounded-t-md flex justify-between items-center print-domain-header">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-muted-foreground text-[10px]">{domain.code}</span>
                                    <span className="font-bold text-[10px] uppercase tracking-wide">{domain.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {domain.avgScore !== null && (
                                        <>
                                            <span className="text-[10px] font-bold">{domain.avgScore.toFixed(2)}</span>
                                            <span className="text-[10px]">{domain.tier?.grade}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Standards & KPIs */}
                            <div className="border border-t-0 border-border rounded-b-md overflow-hidden">
                                {domain.standards.map((standard, stdIdx) => (
                                    <div key={standard.id} className="avoid-break">
                                        {/* Standard Header */}
                                        <div className="bg-card px-3 py-1.5 border-b border-border flex items-center gap-2">
                                            <span className="text-[8px] font-mono font-bold text-muted-foreground">
                                                S{domainIdx + 1}.{stdIdx + 1}
                                            </span>
                                            <span className="text-[9px] font-bold text-foreground">{standard.name}</span>
                                        </div>

                                        {/* KPI Table */}
                                        <table className="w-full text-[9px]">
                                            <tbody>
                                                {standard.kpis.map((kpi, kpiIdx) => {
                                                    const score = kpi.managerScore;
                                                    const isX = score === 'X';
                                                    const numericScore = typeof score === 'number' ? score : null;
                                                    const itemTier = numericScore ? getPerformanceTier(numericScore) : null;

                                                    return (
                                                        <tr key={kpi.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                                                            <td className="py-1.5 pl-6 pr-2 w-12">
                                                                <span className="font-mono text-[8px] text-muted-foreground">
                                                                    K{domainIdx + 1}.{stdIdx + 1}.{kpiIdx + 1}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 pr-3">
                                                                <span className="text-foreground font-medium">{kpi.name}</span>
                                                            </td>
                                                            <td className="py-1.5 pr-3 w-16 text-right">
                                                                {isX ? (
                                                                    <span className="text-[8px] font-medium text-muted-foreground italic">N/I</span>
                                                                ) : numericScore !== null ? (
                                                                    <span className={cn("font-bold", itemTier?.color)}>{numericScore}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-1.5 pr-3 w-8 text-center">
                                                                {!isX && itemTier && (
                                                                    <span className={cn("text-[10px]", itemTier.color)}>{itemTier.grade}</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>

                {/* ===== SIGNATURES ===== */}
                <section className="pt-6 mt-4 border-t border-border avoid-break">
                    {isDirectSelfAssessment ? (
                        <div className="max-w-xs mx-auto text-center">
                            <div className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest mb-3">Approved by</div>
                            <div className="text-base font-serif italic text-foreground border-b border-border pb-1 mb-1">
                                {assessment.director_name || "Director Name"}
                            </div>
                            <div className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">
                                {assessment.director_job_title || "Director"}
                            </div>
                        </div>
                    ) : (assessment.manager_id === assessment.director_id || assessment.manager_name === assessment.director_name) ? (
                        /* Combined Flow */
                        <div className="max-w-xs mx-auto text-center">
                            <div className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest mb-3">Appraised and Approved by</div>
                            <div className="text-base font-serif italic text-foreground border-b border-border pb-1 mb-1">
                                {assessment.director_name || "Director Name"}
                            </div>
                            <div className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">
                                {assessment.director_job_title || "Director"}
                            </div>
                        </div>
                    ) : (
                        /* Standard Flow */
                        <div className="grid grid-cols-2 gap-12">
                            <div className="text-center">
                                <div className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest mb-3">Appraised by</div>
                                <div className="text-base font-serif italic text-foreground border-b border-border pb-1 mb-1">
                                    {assessment.manager_name || "Manager Name"}
                                </div>
                                <div className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">
                                    {assessment.manager_job_title || "Manager"}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest mb-3">Approved by</div>
                                <div className="text-base font-serif italic text-foreground border-b border-border pb-1 mb-1">
                                    {assessment.director_name || "Director Name"}
                                </div>
                                <div className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">
                                    {assessment.director_job_title || "Director"}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Footer */}
                <div className="text-center pt-4 text-[8px] text-muted-foreground">
                    Generated by <span className="font-bold text-muted-foreground">ProofPoint</span> Performance Management System
                </div>
            </div>
        </div>
    );
}

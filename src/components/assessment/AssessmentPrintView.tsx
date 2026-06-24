import { Assessment, calculateWeightedScore } from "@/hooks/useAssessment";
import { DomainData } from "@/hooks/useAssessment";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Image from "next/image";

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
        color: "text-blue-600",
        bg: "bg-blue-50",
        borderColor: "border-blue-200",
        description: "Outstanding performance that exceeds expectations across all domains.",
        bonus: "100%"
    };
    if (score >= 3.6) return {
        label: "Trail Blazers",
        grade: "◆",
        color: "text-blue-600",
        bg: "bg-blue-50",
        borderColor: "border-blue-200",
        description: "High-performing individuals who go beyond role expectations.",
        bonus: "90%"
    };
    if (score >= 3.4) return {
        label: "Rising Star",
        grade: "▲",
        color: "text-blue-500",
        bg: "bg-blue-50",
        borderColor: "border-blue-200",
        description: "Employees showing significant growth and potential.",
        bonus: "80%"
    };
    if (score >= 3.2) return {
        label: "Solid Foundation",
        grade: "●",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        borderColor: "border-emerald-200",
        description: "Reliably meets role expectations.",
        bonus: "65%"
    };
    if (score >= 3.0) return {
        label: "Developing",
        grade: "◐",
        color: "text-emerald-500",
        bg: "bg-emerald-50",
        borderColor: "border-emerald-200",
        description: "Entry level grade, expected to progress.",
        bonus: "50%"
    };
    if (score >= 2.8) return {
        label: "Needs Improvement",
        grade: "○",
        color: "text-amber-600",
        bg: "bg-amber-50",
        borderColor: "border-amber-200",
        description: "Improvement required within defined period.",
        bonus: "40%"
    };
    if (score >= 2.6) return {
        label: "Performance Management",
        grade: "!",
        color: "text-red-600",
        bg: "bg-red-50",
        borderColor: "border-red-200",
        description: "Immediate intervention required.",
        bonus: "10%"
    };
    return {
        label: "Below Threshold",
        grade: "—",
        color: "text-red-700",
        bg: "bg-red-50",
        borderColor: "border-red-200",
        description: "Performance is critically below acceptable standards.",
        bonus: "0%"
    };
}

export function AssessmentPrintView({ assessment, domains, staffName }: AssessmentPrintViewProps) {
    const calculatedScore = calculateWeightedScore(domains, 'manager');
    const managerScore = calculatedScore !== null ? calculatedScore : (Number(assessment.final_score) || 0);
    const tier = getPerformanceTier(managerScore);

    // Calculate domain averages
    const domainScores = domains.map((domain, idx) => {
        let allKPIs: any[] = [];
        domain.standards.forEach(s => allKPIs = [...allKPIs, ...s.kpis]);
        const scoredKPIs = allKPIs.filter(k => k.managerScore !== null && k.managerScore !== undefined && k.managerScore !== 'X');
        const avg = scoredKPIs.length > 0
            ? scoredKPIs.reduce((acc, k) => acc + Number(k.managerScore), 0) / scoredKPIs.length
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
        <div className="fixed inset-0 z-[9999] bg-white text-slate-900 overflow-auto print:static print:p-0 print:overflow-visible font-sans text-[10px] leading-tight">
            {/* ===== HEADER ===== */}
            <div className="bg-slate-900 text-white px-6 py-3 print:py-2">
                <div className="flex justify-between items-center max-w-[210mm] mx-auto">
                    <div className="flex items-center gap-4">
                        {/* Millennia Logo */}
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden p-0.5">
                            <Image
                                src="/millennia-logo.png"
                                alt="Millennia World School"
                                width={36}
                                height={36}
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <h1 className="text-base font-black tracking-tight uppercase">Performance Report</h1>
                            <p className="text-slate-400 text-[8px] font-medium tracking-widest uppercase">
                                Confidential • {format(new Date(), 'MMM d, yyyy')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-bold text-white tracking-wider uppercase">{assessment.period}</div>
                        <div className="text-[8px] font-mono text-slate-400">Ref: {assessment.id.substring(0, 8)}</div>
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="max-w-[210mm] mx-auto px-6 py-4 space-y-4">

                {/* Employee Info Row */}
                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                    <div>
                        <div className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Employee</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-slate-900 leading-none">{displayName}</span>
                            <span className="text-slate-400">/</span>
                            <span className="text-sm text-slate-500 italic">{displayTitle}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Department</div>
                        <div className="text-[10px] font-bold text-slate-700">{assessment.staff_department || "General"}</div>
                    </div>
                </div>

                {/* ===== EXECUTIVE SUMMARY ===== */}
                <section className="avoid-break">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-0.5 w-4 bg-slate-900"></div>
                        <h2 className="text-[9px] font-black uppercase tracking-widest text-slate-900">Executive Summary</h2>
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
                            <p className="text-[8px] text-slate-600 leading-relaxed mb-2">
                                {tier.description}
                            </p>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50">
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Bonus Payout</span>
                                <span className={cn("text-[10px] font-black", tier.color)}>{tier.bonus}</span>
                            </div>
                        </div>

                        {/* Domain Breakdown Table */}
                        <div className="col-span-8">
                            <table className="w-full text-[9px]">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-1 font-bold text-slate-400 uppercase tracking-wider">Domain</th>
                                        <th className="text-right py-1 font-bold text-slate-400 uppercase tracking-wider w-16">Score</th>
                                        <th className="text-center py-1 font-bold text-slate-400 uppercase tracking-wider w-24">Tier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {domainScores.map(domain => (
                                        <tr key={domain.id} className="border-b border-slate-100">
                                            <td className="py-1.5">
                                                <span className="font-mono font-bold text-slate-400 mr-2">{domain.code}</span>
                                                <span className="font-semibold text-slate-700">{domain.name}</span>
                                            </td>
                                            <td className="text-right py-1.5">
                                                {domain.avgScore !== null ? (
                                                    <span className={cn("font-bold", domain.tier?.color)}>{domain.avgScore.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
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
                        <div className="h-0.5 w-4 bg-slate-900"></div>
                        <h2 className="text-[9px] font-black uppercase tracking-widest text-slate-900">Detailed Framework Breakdown</h2>
                    </div>

                    {domainScores.map((domain, domainIdx) => (
                        <div key={domain.id} className="avoid-break">
                            {/* Domain Header */}
                            <div className="bg-slate-800 text-white px-3 py-1.5 rounded-t-md flex justify-between items-center print-domain-header">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-300 text-[10px]">{domain.code}</span>
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
                            <div className="border border-t-0 border-slate-200 rounded-b-md overflow-hidden">
                                {domain.standards.map((standard, stdIdx) => (
                                    <div key={standard.id} className="avoid-break">
                                        {/* Standard Header */}
                                        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                                            <span className="text-[8px] font-mono font-bold text-slate-400">
                                                S{domainIdx + 1}.{stdIdx + 1}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-700">{standard.name}</span>
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
                                                        <tr key={kpi.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                                            <td className="py-1.5 pl-6 pr-2 w-12">
                                                                <span className="font-mono text-[8px] text-slate-400">
                                                                    K{domainIdx + 1}.{stdIdx + 1}.{kpiIdx + 1}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 pr-3">
                                                                <span className="text-slate-800 font-medium">{kpi.name}</span>
                                                            </td>
                                                            <td className="py-1.5 pr-3 w-16 text-right">
                                                                {isX ? (
                                                                    <span className="text-[8px] font-medium text-slate-400 italic">N/I</span>
                                                                ) : numericScore !== null ? (
                                                                    <span className={cn("font-bold", itemTier?.color)}>{numericScore}</span>
                                                                ) : (
                                                                    <span className="text-slate-300">—</span>
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
                <section className="pt-6 mt-4 border-t border-slate-200 avoid-break">
                    {(assessment.manager_id === assessment.director_id || assessment.manager_name === assessment.director_name) ? (
                        /* Combined Flow */
                        <div className="max-w-xs mx-auto text-center">
                            <div className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-3">Appraised and Approved by</div>
                            <div className="text-base font-serif italic text-slate-900 border-b border-slate-900 pb-1 mb-1">
                                {assessment.director_name || "Director Name"}
                            </div>
                            <div className="text-[8px] font-medium text-slate-500 uppercase tracking-wider">
                                {assessment.director_job_title || "Director"}
                            </div>
                        </div>
                    ) : (
                        /* Standard Flow */
                        <div className="grid grid-cols-2 gap-12">
                            <div className="text-center">
                                <div className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-3">Appraised by</div>
                                <div className="text-base font-serif italic text-slate-900 border-b border-slate-900 pb-1 mb-1">
                                    {assessment.manager_name || "Manager Name"}
                                </div>
                                <div className="text-[8px] font-medium text-slate-500 uppercase tracking-wider">
                                    {assessment.manager_job_title || "Manager"}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-3">Approved by</div>
                                <div className="text-base font-serif italic text-slate-900 border-b border-slate-900 pb-1 mb-1">
                                    {assessment.director_name || "Director Name"}
                                </div>
                                <div className="text-[8px] font-medium text-slate-500 uppercase tracking-wider">
                                    {assessment.director_job_title || "Director"}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Footer */}
                <div className="text-center pt-4 text-[8px] text-slate-400">
                    Generated by <span className="font-bold text-slate-500">ProofPoint</span> Performance Management System
                </div>
            </div>
        </div>
    );
}

'use client';

import { cn } from "@/lib/utils";

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import {
    AssessmentSection,
    AssessmentProgress,
    ReviewComparisonSection,
    WeightedScoreDisplay
} from '@/components/assessment';
import { Accordion } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    useAssessment,
    useRubricTemplates,
    useMyAssessments,
    calculateWeightedScore,
    Assessment,
    DomainData,
    StandardData,
    KPIData
} from '@/hooks/useAssessment';
import { useAuth } from '@/hooks/useAuth';
import { getAutomaticPeriod } from '@/lib/utils';
import {
    ClipboardList,
    Save,
    Send,
    ArrowLeft,
    Loader2,
    Calendar,
    Layout,
    AlertCircle,
    ShieldCheck,
    MessageSquare,
    Info,
    Trash2,
    Clock,
    RotateCcw
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useEffect } from 'react';
import { api } from '@/lib/api-client';

function AssessmentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const assessmentId = searchParams.get('id');
    const { profile, roles, isAdmin } = useAuth();

    const {
        assessment,
        domains,
        loading: assessmentLoading,
        saving,
        saveDraft,
        submitAssessment,
        updateKPI,
        staffAcknowledgement,
        setStaffAcknowledgement,
        acknowledgeAssessment,
        managerFeedback,
        directorFeedback,
        deleteAssessment
    } = useAssessment(assessmentId || undefined);

    const { templates, loading: templatesLoading } = useRubricTemplates();
    const { assessments, createAssessment } = useMyAssessments();

    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [period, setPeriod] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);
    const [showStickyBar, setShowStickyBar] = useState(false);

    // Scroll detection for sticky bar
    useEffect(() => {
        if (!assessmentId) return;

        const handleScroll = () => {
            setShowStickyBar(window.scrollY > 300);
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, [assessmentId]);

    // Auto-prefill period and rubric based on assignment
    useEffect(() => {
        if (!assessmentId) {
            setPeriod(getAutomaticPeriod());
        }
    }, [assessmentId]);

    useEffect(() => {
        const fetchAssignedRubric = async () => {
            if (assessmentId || !profile) return;

            const { data, error } = await api.getDepartmentRoles();
            if (error) {
                console.error('Failed to fetch department roles:', error);
                return;
            }

            if (data) {
                const configs = data as any[];

                // Finalize matched role - convert to lowercase for matching
                const normalizedRoles = roles.map(r => r.toLowerCase());
                let assignedConfig = null;

                // 1. Try to find a department-specific match for ANY of the user's roles
                for (const role of normalizedRoles) {
                    const match = configs.find(c =>
                        String(c.department_id) === String(profile.department_id) &&
                        c.role.toLowerCase() === role
                    );
                    if (match) {
                        assignedConfig = match;
                        break;
                    }
                }

                // 2. Fallback: Try global roles for ANY of the user's roles
                if (!assignedConfig) {
                    for (const role of normalizedRoles) {
                        const match = configs.find(c =>
                            !c.department_id &&
                            c.role.toLowerCase() === role
                        );
                        if (match) {
                            assignedConfig = match;
                            break;
                        }
                    }
                }

                // 3. Last fallback: Try any 'staff' configuration for this department
                if (!assignedConfig) {
                    assignedConfig = configs.find(c =>
                        String(c.department_id) === String(profile.department_id) &&
                        c.role.toLowerCase() === 'staff'
                    );
                }

                if (assignedConfig?.default_template_id) {
                    setSelectedTemplate(assignedConfig.default_template_id);
                } else {
                    setSelectedTemplate('');
                }
            }
        };

        if (!assessmentId && profile) {
            fetchAssignedRubric();
        }
    }, [assessmentId, profile, roles]);

    // Track if we have a forced selection
    const isRubricForced = !!selectedTemplate;

    const handleCreate = async () => {
        if (!selectedTemplate || !period) return;

        // Final double check for existing draft to prevent double clicking/race conditions
        const existingDraft = assessments.find((a: Assessment) =>
            a.template_id === selectedTemplate &&
            a.period === period &&
            a.status !== 'acknowledged'
        );

        if (existingDraft) {
            router.push(`/assessment?id=${existingDraft.id}`);
            return;
        }

        setIsCreating(true);
        const newAssessment = await createAssessment(selectedTemplate, period);
        if (newAssessment) {
            router.push(`/assessment?id=${newAssessment.id}`);
        }
        setIsCreating(false);
    };

    const weightedScore = calculateWeightedScore(domains, 'staff');
    const finalWeightedScore = calculateWeightedScore(domains, 'manager');

    // Loading State
    if (assessmentId && assessmentLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading assessment...</p>
            </div>
        );
    }

    // Selection View (No ID)
    if (!assessmentId) {
        return (
            <div className="max-w-2xl mx-auto py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-black tracking-tight mb-2">Self-Assessment</h1>
                    <p className="text-muted-foreground text-lg">Choose a period and template to start your performance evaluation within the Framework.</p>
                </div>

                <Card className="glass-panel border-border/30 shadow-2xl overflow-hidden">
                    <div className="h-2 bg-primary w-full" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">New Assessment Cycle</CardTitle>
                        <CardDescription>Enter the review period details and select your functional rubric.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
                        <div className="space-y-3">
                            <Label htmlFor="period" className="font-bold">Review Period</Label>
                            <div className="relative group">
                                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="period"
                                    placeholder="e.g., Annual Review 2024"
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    className="pl-9 h-11 bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold flex items-center gap-2 text-primary">
                                    <Layout className="h-4 w-4" />
                                    Functional Rubric
                                </label>
                                <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={isCreating}>
                                    <SelectTrigger className="w-full h-14 bg-background border-primary/20 focus:ring-primary/40 text-lg">
                                        <SelectValue placeholder="Select the appropriate rubric" />
                                    </SelectTrigger>
                                    <SelectContent className="glass-panel-strong">
                                        {templatesLoading ? (
                                            <div className="flex items-center justify-center p-4">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            </div>
                                        ) : (
                                            templates
                                                .filter(t => !selectedTemplate || t.id === selectedTemplate)
                                                .map((t) => (
                                                    <SelectItem key={t.id} value={t.id} className="focus:bg-primary focus:text-white">
                                                        <div className="flex flex-col py-1">
                                                            <span className="font-bold">{t.name}</span>
                                                            <span className="text-[10px] opacity-70">Comprehensive KPI Framework</span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {isRubricForced && (
                                    <p className="text-[10px] text-primary flex items-center gap-1 mt-1 font-medium animate-pulse">
                                        <ShieldCheck className="h-3 w-3" />
                                        This rubric has been assigned to you by an administrator based on your department and role.
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-4 pt-2">
                                {period && selectedTemplate && assessments.find((a: Assessment) =>
                                    a.template_id === selectedTemplate &&
                                    a.period === period &&
                                    a.status !== 'acknowledged'
                                ) ? (
                                    <Alert className="bg-primary/5 border-primary/20">
                                        <Info className="h-4 w-4 text-primary" />
                                        <AlertTitle className="text-sm font-bold">Active Assessment Found</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            You already have an active assessment for this period and rubric.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                <Button
                                    className="w-full h-12 text-base font-bold transition-all duration-300 shadow-lg hover:shadow-primary/20"
                                    disabled={!selectedTemplate || !period || isCreating}
                                    onClick={handleCreate}
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Initializing...
                                        </>
                                    ) : (
                                        assessments.find((a: Assessment) =>
                                            a.template_id === selectedTemplate &&
                                            a.period === period &&
                                            a.status !== 'acknowledged'
                                        ) ? (
                                            <>
                                                <ClipboardList className="h-4 w-4 mr-2" />
                                                Continue Assessment
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Start Performance Review
                                            </>
                                        )
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* My Previous Appraisals Section */}
                {assessments.filter(a => ['director_approved', 'admin_reviewed', 'acknowledged'].includes(a.status)).length > 0 && (
                    <Card className="glass-panel border-border/30 shadow-lg overflow-hidden mt-8">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-primary" />
                                My Previous Appraisals
                            </CardTitle>
                            <CardDescription>View your finalized performance assessments from previous cycles.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {assessments
                                .filter(a => ['director_approved', 'admin_reviewed', 'acknowledged'].includes(a.status))
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .map((a: Assessment) => (
                                    <div
                                        key={a.id}
                                        onClick={() => router.push(`/assessment?id=${a.id}`)}
                                        className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/30 hover:border-primary/50 hover:bg-primary/[0.02] transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{a.period}</h4>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(a.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge className={a.status === 'acknowledged'
                                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                : "bg-blue-100 text-blue-700 border-blue-200"
                                            }>
                                                {a.status === 'acknowledged' ? 'Completed' : 'Pending Acknowledgement'}
                                            </Badge>
                                            <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 group-hover:text-primary transition-all" />
                                        </div>
                                    </div>
                                ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // Active Assessment Form View
    const isDirectorApprovedOnly = assessment?.status === 'director_approved';
    const isAdminReviewed = assessment?.status === 'admin_reviewed';
    const isAcknowledged = assessment?.status === 'acknowledged';
    const isReturned = assessment?.status === 'returned';
    const isReadOnly = assessment?.status !== 'draft' && assessment?.status !== 'rejected' && assessment?.status !== 'returned' && !isDirectorApprovedOnly;

    // Only show comparison and allow acknowledgment if Admin has reviewed/released it (or it's already acknowledged)
    const showComparison = isAdminReviewed || isAcknowledged;

    return (
        <div className="max-w-7xl mx-auto py-8">
            {/* Returned for Revision Alert */}
            {isReturned && assessment?.return_feedback && (
                <Alert className="mb-8 border-2 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500 bg-amber-50 border-amber-500/50">
                    <RotateCcw className="h-5 w-5 text-amber-600" />
                    <AlertTitle className="font-bold text-lg mb-2 text-amber-800">
                        Assessment Returned for Revision
                    </AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p className="text-amber-900">
                            Your assessment has been returned by your reviewer. Please review the feedback below and make the necessary corrections before resubmitting.
                        </p>
                        <div className="bg-white/50 border border-amber-200 rounded-lg p-4 mt-3">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Reviewer Feedback</span>
                            </div>
                            <p className="text-amber-950 whitespace-pre-wrap leading-relaxed">
                                {assessment.return_feedback}
                            </p>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* Feedback Bar */}
            {isReadOnly && (
                <Alert className={cn(
                    "mb-8 border-2 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500",
                    isAcknowledged ? "bg-emerald-50 border-emerald-500/30" :
                        isAdminReviewed ? "bg-amber-50 border-amber-500/30" :
                            isDirectorApprovedOnly ? "bg-blue-50 border-blue-500/30" :
                                "bg-primary/5 border-primary/20"
                )}>
                    {isAcknowledged ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> :
                        isAdminReviewed ? <MessageSquare className="h-5 w-5 text-amber-600" /> :
                            isDirectorApprovedOnly ? <Clock className="h-5 w-5 text-blue-600" /> :
                                <AlertCircle className="h-5 w-5 text-primary" />}

                    <AlertTitle className="font-bold text-lg mb-1">
                        {isAcknowledged ? "Cycle Complete" :
                            isAdminReviewed ? "Action Required" :
                                isDirectorApprovedOnly ? "Review Process Update" :
                                    "Review in Progress"}
                    </AlertTitle>
                    <AlertDescription className="text-base">
                        {isAcknowledged
                            ? "This assessment cycle is complete. Final results have been archived."
                            : isAdminReviewed
                                ? "The Admin has released your assessment results. Please review and acknowledge below."
                                : isDirectorApprovedOnly
                                    ? "Your assessment has been approved by the Director and is currently pending final release by an Administrator."
                                    : `This assessment has been submitted and is currently ${assessment?.status?.replace('_', ' ') || 'pending'}.`}
                    </AlertDescription>
                </Alert>
            )}

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-6">
                    <Button variant="outline" size="icon" onClick={() => router.push('/dashboard')} className="h-12 w-12 rounded-xl shadow-sm hover:bg-muted/50 border-muted-foreground/20">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-4xl font-black tracking-tight">{assessment?.period}</h1>
                            {isReadOnly && <Badge variant="secondary" className="bg-muted-foreground/10 text-muted-foreground font-mono">READ ONLY</Badge>}
                        </div>
                        <p className="text-muted-foreground text-lg italic">KPI-Based Self-Assessment & Performance Framework</p>
                    </div>
                </div>

                {!isReadOnly && !isDirectorApprovedOnly && (
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={saveDraft} disabled={saving} className="h-12 px-6 rounded-xl border-primary/20 hover:bg-primary/5 transition-all">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Draft
                        </Button>
                        <Button className="h-12 px-8 rounded-xl font-bold glow-primary transition-all duration-300" onClick={submitAssessment} disabled={saving}>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Review
                        </Button>
                    </div>
                )}

                {isReadOnly && isAdmin && (
                    <div className="flex items-center gap-4">
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (window.confirm("Are you sure you want to delete this assessment? This action cannot be undone.")) {
                                    if (await deleteAssessment()) {
                                        router.push('/dashboard');
                                    }
                                }
                            }}
                            disabled={saving}
                            className="h-12 px-6 rounded-xl shadow-lg hover:shadow-destructive/20 transition-all font-bold"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Assessment
                        </Button>
                    </div>
                )}

                {!isReadOnly && !isDirectorApprovedOnly && (
                    <div className="ml-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                                if (window.confirm("Are you sure you want to delete this draft?")) {
                                    if (await deleteAssessment()) {
                                        router.push('/dashboard');
                                    }
                                }
                            }}
                            disabled={saving}
                            className="h-12 w-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                )}
            </div>

            <div className="mb-10">
                <Card className="glass-panel border-border/30 shadow-lg overflow-hidden">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Layout className="h-5 w-5 text-primary" />
                            Cycle Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-8">
                        <AssessmentProgress status={assessment?.status || 'draft'} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content: Domains */}
                <div className="lg:col-span-8 space-y-10">
                    {showComparison ? (
                        <>
                            <Accordion type="multiple" className="w-full space-y-4">
                                {domains.map((domain: DomainData) => (
                                    <ReviewComparisonSection
                                        key={domain.id}
                                        readonly={true}
                                        reviewerLabel="Director"
                                        section={{
                                            ...domain,
                                            standards: domain.standards.map((s: StandardData) => ({
                                                ...s,
                                                kpis: s.kpis.map((k: KPIData) => ({
                                                    ...k,
                                                    description: k.description || '',
                                                    staffScore: k.score,
                                                    staffEvidence: k.evidence,
                                                    managerScore: k.managerScore ?? null,
                                                    managerEvidence: k.managerEvidence ?? ''
                                                }))
                                            }))
                                        }}
                                    />
                                ))}
                            </Accordion>

                            {/* Director Final Feedback Section (Read-only for staff) */}
                            <Card className="glass-panel border-border/30 overflow-hidden shadow-xl">
                                <CardHeader className="bg-emerald-500/5 border-b border-border/10 pb-6 pt-8 px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                                            <ShieldCheck className="h-6 w-6" />
                                        </div>
                                        <CardTitle className="text-2xl font-black">Director Final Feedback</CardTitle>
                                    </div>
                                    <CardDescription className="text-base mt-2">Final assessment summary and organizational feedback from the Director.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-8 px-8 pb-10">
                                    <div className="space-y-6">
                                        <div className="relative">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20 rounded-full" />
                                            <div className="pl-6 py-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Director's Comments</span>
                                                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                                                    {directorFeedback || <span className="text-muted-foreground italic">No feedback provided</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-500/20 text-emerald-700">
                                            <ShieldCheck className="h-6 w-6" />
                                            <div className="text-sm font-bold">
                                                Director Approved & Signed
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Staff Acknowledgement Section - ONLY SHOW IF ADMIN REVIEWED OR ACKNOWLEDGED */}
                            <Card className="glass-panel border-border/30 overflow-hidden shadow-2xl">
                                <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 pt-8 px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <MessageSquare className="h-6 w-6" />
                                        </div>
                                        <CardTitle className="text-2xl font-black">Staff Acknowledgement</CardTitle>
                                    </div>
                                    <CardDescription className="text-base mt-2">Final response and signature for the performance review cycle.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-8 px-8 pb-10">
                                    {isAcknowledged ? (
                                        <div className="space-y-6">
                                            <div className="relative">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 rounded-full" />
                                                <div className="pl-6 py-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">My Final Comments</span>
                                                    <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                                                        {staffAcknowledgement || <span className="text-muted-foreground italic">No feedback provided</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-500/20 text-emerald-700">
                                                <ShieldCheck className="h-6 w-6" />
                                                <div className="text-sm font-bold">
                                                    Electronically Signed & Acknowledged
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-xl text-amber-900 shadow-sm">
                                                <div className="flex gap-4">
                                                    <Info className="h-6 w-6 text-amber-500 shrink-0" />
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-base">Framework Review Complete</p>
                                                        <p className="text-sm opacity-80 leading-relaxed">
                                                            Please review the final results and manager feedback across all domains.
                                                            Provide your signature and any final reflections below to conclude this cycle.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <Label htmlFor="staff-feedback" className="text-base font-bold flex items-center gap-2">
                                                    Reflections & Acknowledgement <span className="text-destructive">*</span>
                                                </Label>
                                                <Textarea
                                                    id="staff-feedback"
                                                    placeholder="Enter your final reflections on the review period, accomplishments, and alignment with the framework..."
                                                    className="min-h-[200px] bg-background border-primary/20 focus-visible:ring-primary/40 text-base leading-relaxed p-4 shadow-inner"
                                                    value={staffAcknowledgement}
                                                    onChange={(e) => setStaffAcknowledgement(e.target.value)}
                                                />
                                            </div>

                                            <Button
                                                className="w-full h-14 text-lg font-black tracking-wide shadow-xl hover:shadow-primary/30 transition-all duration-300"
                                                onClick={acknowledgeAssessment}
                                                disabled={saving || !staffAcknowledgement.trim()}
                                            >
                                                {saving ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <ShieldCheck className="h-6 w-6 mr-3" />}
                                                Finalize Cycle & Sign Results
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="space-y-4">
                            {/* If waiting for admin, show placeholder or readonly self assessment */}
                            {isDirectorApprovedOnly && (
                                <Card className="glass-panel border-border/30 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                                    <div className="p-4 rounded-full bg-blue-100 mb-6 animate-pulse">
                                        <Clock className="h-12 w-12 text-blue-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">Pending Administrative Release</h3>
                                    <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed">
                                        Your assessment has been approved by the Director and is currently awaiting final release by the Administration team.
                                        You will be notified once the results are available for your acknowledgment.
                                    </p>
                                </Card>
                            )}

                            {/* Still show the accordion, but maybe strictly readonly with NO manager scores visible if we want? 
                                 Actually, if it's NOT ShowComparison, we usually show the editable form.
                                 If it IS readOnly (which isDirectorApprovedOnly is part of), we show the form in readonly mode.
                                 BUT, we want to hide Manager Scores. 
                                 The standard AssessmentSection shows manager scores if they exist? 
                                 Let's check AssessmentSection. 
                                 
                                 If showComparison is false, we render AssessmentSection. 
                                 AssessmentSection handles readonly. 
                                 Does it show manager scores? Usually no, unless we pass them?
                                 Actually, AssessmentSection uses the 'section' prop which is from 'domains'.
                                 'domains' has manager scores.
                                 
                                 Wait, AssessmentSection is for the USER's input. 
                                 It usually doesn't show manager scores. That's what ReviewComparisonSection is for.
                                 So if showComparison is false, we are just showing the user's self assessment.
                                 Which is CORRECT for the "Pending" state - they see what they submitted, but not the result yet.
                             */}
                            <Accordion type="multiple" className="w-full space-y-4">
                                {domains.map((domain) => (
                                    <AssessmentSection
                                        key={domain.id}
                                        section={domain}
                                        onIndicatorChange={updateKPI}
                                        readonly={isReadOnly}
                                    />
                                ))}
                            </Accordion>
                        </div>
                    )}
                </div>

                {/* Sidebar: Progress & Score */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="sticky top-24 space-y-8">
                        {/* Only show Final Score if authorized */}
                        {showComparison && (
                            <WeightedScoreDisplay
                                domains={domains}
                                score={finalWeightedScore}
                                label="Final Score"
                                type="manager"
                                showAlways={true}
                            />
                        )}

                        {/* Always show projected score (self score) if NOT comparison mode? Or maybe keep it? 
                            If showComparison is false, weightedScoreDisplay shows "Projected Score" (self).
                            That is fine to keep visible as it's their own input.
                        */}
                        {!showComparison && (
                            <WeightedScoreDisplay
                                domains={domains}
                                score={weightedScore}
                                label="Projected Score"
                                type="staff"
                                showAlways={true}
                            />
                        )}

                        <Card className="bg-muted/30 border-dashed border-2 border-muted-foreground/10">
                            <CardContent className="pt-6 pb-6 px-6">
                                <div className="flex gap-4 items-start">
                                    <Info className="h-5 w-5 text-muted-foreground/60 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                                        The Grade is calculated based on domain weights defined in the organizational playbook.
                                        KPIs marked as <strong>'X'</strong> are excluded from the performance calculation for this period.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Sticky Action Bar at Bottom */}
            {!isReadOnly && !isDirectorApprovedOnly && showStickyBar && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/50 py-4 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
                    <div className="container px-4 flex items-center justify-between">
                        <div className="hidden md:flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Assessment</span>
                            <span className="text-sm font-bold truncate max-w-[200px]">{assessment?.period}</span>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <Button
                                variant="outline"
                                onClick={saveDraft}
                                disabled={saving}
                                className="flex-1 md:flex-none h-12 px-6 rounded-xl border-primary/20 hover:bg-primary/5 transition-all"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Draft
                            </Button>
                            <Button
                                className="flex-[2] md:flex-none h-12 px-8 rounded-xl font-bold glow-primary transition-all duration-300"
                                onClick={submitAssessment}
                                disabled={saving}
                            >
                                <Send className="h-4 w-4 mr-2" />
                                Submit Review
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AssessmentPage() {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-background relative">
                <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
                <Header />
                <main className="container relative px-4 py-8">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center min-h-[60vh]">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    }>
                        <AssessmentContent />
                    </Suspense>
                </main>
            </div>
        </ProtectedRoute>
    );
}

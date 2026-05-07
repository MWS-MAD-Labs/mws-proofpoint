"use client";

import { toast } from "@/hooks/use-toast";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import {
  AssessmentProgress,
  ReviewComparisonSection,
  WeightedScoreDisplay,
} from "@/components/assessment";
import { ScoreComparisonWidget } from "@/components/assessment/ScoreComparisonWidget";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { AssessmentPrintView } from "@/components/assessment/AssessmentPrintView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useAssessment,
  useTeamAssessments,
  calculateWeightedScore,
  DomainData,
  StandardData,
  KPIData,
} from "@/hooks/useAssessment";
import {
  Users,
  ChevronRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  FileText,
  Trash2,
  ShieldCheck,
  Layout,
  Info,
  RotateCcw,
  Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ManagerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("id");
  const isPrintMode = searchParams.get("print") === "true";

  const { assessments, loading: listLoading } = useTeamAssessments();
  const {
    assessment,
    domains,
    loading: assessmentLoading,
    updateKPI: updateIndicator,
    saveDraft,
    submitReview,
    saving,
    managerFeedback,
    setManagerFeedback,
    directorFeedback,
    staffAcknowledgement,
    deleteAssessment,
    returnAssessment,
  } = useAssessment(assessmentId || undefined);

  const { isAdmin, user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnFeedbackInput, setReturnFeedbackInput] = useState("");

  useEffect(() => {
    if (isPrintMode && !assessmentLoading && assessment) {
      const originalTitle = document.title;
      const period = assessment.period || "Assessment";
      const name = assessment.staff_name || "Staff";
      document.title = `${name} - ${period}`;

      setTimeout(() => {
        window.print();
      }, 500);

      return () => {
        document.title = originalTitle;
      };
    }
  }, [isPrintMode, assessmentLoading, assessment]);

  const currentStaffName = assessments.find(
    (a) => a.id === assessmentId,
  )?.staff_name;

  if (isPrintMode && assessment && domains) {
    return (
      <AssessmentPrintView
        assessment={assessment}
        domains={domains}
        staffName={currentStaffName}
      />
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Draft
          </Badge>
        );
      case "self_submitted":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            Pending Review
          </Badge>
        );
      case "manager_reviewed":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            Reviewed
          </Badge>
        );
      case "director_approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            Approved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter out current user's own assessments - they should appear in Self-Assessment page instead
  const teamAssessments = assessments.filter((a) => a.staff_id !== user?.id);

  const filteredAssessments = teamAssessments.filter(
    (a) =>
      a.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.staff_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.period.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Check loading for detailed view
  if (assessmentId && !assessment && !assessmentLoading) {
    return <div>Assessment not found</div>;
  }

  // Filter assessments
  const activeAssessments = filteredAssessments.filter(
    (a) => a.status !== "acknowledged",
  );
  const completedAssessments = filteredAssessments.filter(
    (a) => a.status === "acknowledged",
  );

  const handleDownloadPDF = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    toast({
      title: "Opening Report",
      description: "Opening print view for assessment report...",
    });

    // Open the assessment detail in a new window with print=true param
    const url = `/manager?id=${id}&print=true`;
    window.open(url, "_blank");
  };

  const staffWeightedScore = calculateWeightedScore(domains, "staff");
  const managerWeightedScore = calculateWeightedScore(domains, "manager");
  const isReadOnly =
    assessment?.status === "manager_reviewed" ||
    assessment?.status === "director_approved" ||
    assessment?.status === "acknowledged";
  const isApproved =
    assessment?.status === "director_approved" ||
    assessment?.status === "acknowledged";

  const content = assessmentId ? (
    // Detailed Assessment View - matches director page layout
    <div className="max-w-7xl mx-auto py-8">
      {/* Status Alert Bar */}
      {isApproved && (
        <Alert className="mb-8 border-2 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 bg-emerald-50 border-emerald-500/30">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="font-bold text-lg mb-1">
            {assessment?.status === "acknowledged"
              ? "Cycle Complete"
              : "Director Approved"}
          </AlertTitle>
          <AlertDescription className="text-base">
            {assessment?.status === "acknowledged"
              ? "This assessment cycle is complete. Final results have been archived."
              : "This assessment has been approved by the director and is awaiting staff acknowledgement."}
          </AlertDescription>
        </Alert>
      )}

      {/* Header Actions - matches director page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/manager")}
            className="h-12 w-12 rounded-xl shadow-sm hover:bg-muted/50 border-muted-foreground/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-4xl font-black tracking-tight">
                Manager Review
              </h1>
              {isReadOnly && (
                <Badge
                  variant="secondary"
                  className="bg-muted-foreground/10 text-muted-foreground font-mono"
                >
                  READ ONLY
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-lg">
              {assessment?.staff_name} • {assessment?.period}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
              className="h-12 px-6 rounded-xl border-primary/20 hover:bg-primary/5 transition-all"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>

            {/* Return for Revision Dialog */}
            <AlertDialog
              open={returnDialogOpen}
              onOpenChange={setReturnDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-12 px-6 rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all"
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Return for Revision
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                    <RotateCcw className="h-5 w-5" />
                    Return Assessment for Revision
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4">
                      <p>
                        This will return the assessment to{" "}
                        <strong>{assessment?.staff_name}</strong> for revision.
                        Please provide clear feedback on what needs to be
                        corrected.
                      </p>
                      <div className="space-y-2">
                        <Label
                          htmlFor="return-feedback-manager"
                          className="text-sm font-semibold text-foreground"
                        >
                          Return Feedback{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="return-feedback-manager"
                          placeholder="Please describe what needs to be revised or corrected..."
                          className="min-h-[120px] resize-none"
                          value={returnFeedbackInput}
                          onChange={(e) =>
                            setReturnFeedbackInput(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setReturnFeedbackInput("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={!returnFeedbackInput.trim() || saving}
                    onClick={async (e) => {
                      e.preventDefault();
                      if (
                        user &&
                        (await returnAssessment(returnFeedbackInput, user.id))
                      ) {
                        setReturnDialogOpen(false);
                        setReturnFeedbackInput("");
                        router.push("/manager");
                      }
                    }}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Return for Revision
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              className="h-12 px-8 rounded-xl font-bold glow-primary transition-all duration-300"
              onClick={submitReview}
              disabled={saving || !managerFeedback.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Submit Review
            </Button>
          </div>
        )}

        {isReadOnly && isAdmin && (
          <Button
            variant="destructive"
            onClick={async () => {
              if (
                window.confirm(
                  "Are you sure you want to delete this assessment? This action cannot be undone.",
                )
              ) {
                if (await deleteAssessment()) {
                  router.push("/manager");
                }
              }
            }}
            disabled={saving}
            className="h-12 px-6 rounded-xl shadow-lg hover:shadow-destructive/20 transition-all font-bold"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Assessment
          </Button>
        )}
      </div>

      {/* Cycle Progress Panel - matches director page */}
      <div className="mb-10">
        <Card className="glass-panel border-border/30 shadow-lg overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Layout className="h-5 w-5 text-primary" />
              Cycle Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <AssessmentProgress
              status={assessment?.status || "self_submitted"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid - 12 column layout like director page */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content: Domains - 8 columns */}
        <div className="lg:col-span-8 space-y-10">
          <Accordion type="multiple" className="w-full space-y-4">
            {domains.map((domain: DomainData, index: number) => (
              <ReviewComparisonSection
                key={domain.id}
                index={index}
                onIndicatorChange={updateIndicator}
                readonly={isReadOnly}
                section={{
                  ...domain,
                  standards: domain.standards.map((s: StandardData) => ({
                    ...s,
                    kpis: s.kpis.map((i: KPIData) => ({
                      ...i,
                      description: i.description || "",
                      staffScore: i.score,
                      staffEvidence: i.evidence,
                      managerScore: i.managerScore ?? null,
                      managerEvidence: i.managerEvidence ?? "",
                    })),
                  })),
                }}
              />
            ))}
          </Accordion>

          {/* Overall Feedback Section */}
          <Card className="glass-panel border-border/30 overflow-hidden mt-8">
            <CardHeader className="bg-primary/[0.03] border-b border-border/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {isReadOnly &&
                (assessment?.status === "director_approved" ||
                  assessment?.status === "acknowledged")
                  ? "Assessment Feedback Summary"
                  : "Overall Manager Feedback"}
              </CardTitle>
              <CardDescription>
                {isReadOnly &&
                (assessment?.status === "director_approved" ||
                  assessment?.status === "acknowledged")
                  ? "Complete feedback history from all stakeholders"
                  : "Provide a summary rationale for the final grade and general comments on performance."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isReadOnly ? (
                <div className="space-y-6">
                  {/* Staff Acknowledgment - only show if assessment is acknowledged */}
                  {assessment?.status === "acknowledged" &&
                    staffAcknowledgement && (
                      <div className="relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20 rounded-full" />
                        <div className="pl-6 py-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                            Staff Acknowledgment & Feedback
                          </span>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {staffAcknowledgement}
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Manager Feedback - always show in readonly if available */}
                  {managerFeedback && (
                    <div className="relative">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 rounded-full" />
                      <div className="pl-6 py-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                          Manager Feedback
                        </span>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {managerFeedback}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Director Feedback - show if available */}
                  {directorFeedback &&
                    (assessment?.status === "director_approved" ||
                      assessment?.status === "acknowledged") && (
                      <div className="relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20 rounded-full" />
                        <div className="pl-6 py-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                            Director Feedback
                          </span>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {directorFeedback}
                          </p>
                        </div>
                      </div>
                    )}

                  {!managerFeedback &&
                    !directorFeedback &&
                    !staffAcknowledgement && (
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-foreground whitespace-pre-wrap">
                        <span className="text-muted-foreground italic">
                          No feedback provided
                        </span>
                      </div>
                    )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="overall-feedback"
                      className="text-sm font-semibold"
                    >
                      Summary Comments{" "}
                      <span className="text-evidence-alert">*</span>
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      This feedback is required for submission
                    </span>
                  </div>
                  <Textarea
                    id="overall-feedback"
                    placeholder="Summarize the performance review, highlight strengths, and note areas for development..."
                    className="min-h-[200px] bg-background border-primary/20 focus-visible:ring-primary/30 text-base"
                    value={managerFeedback}
                    onChange={(e) => setManagerFeedback(e.target.value)}
                  />
                  {!managerFeedback.trim() && (
                    <div className="flex items-center gap-2 text-xs text-evidence-alert mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Please provide overall feedback before submitting
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Progress & Score - 4 columns */}
        <div className="lg:col-span-4 space-y-8">
          <div className="sticky top-24 space-y-8">
            {/* Score Comparison Widget - same as director page */}
            <ScoreComparisonWidget
              domains={domains}
              finalScore={managerWeightedScore}
              projectedScore={staffWeightedScore}
            />

            <Card className="bg-muted/30 border-dashed border-2 border-muted-foreground/10">
              <CardContent className="pt-6 pb-6 px-6">
                <div className="flex gap-4 items-start">
                  <Info className="h-5 w-5 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                    The Grade is calculated based on domain weights defined in
                    the organizational playbook. KPIs marked as{" "}
                    <strong>'X'</strong> are excluded from the performance
                    calculation for this period.
                  </p>
                </div>
              </CardContent>
            </Card>

            {!isReadOnly && (
              <Alert className="bg-primary/5 border-primary/10">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle className="text-sm font-semibold">
                  Quick Tip
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Compare the staff's self-assessment with their evidence. You
                  can provide your own scores and feedback for each indicator.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : (
    // Dashboard List View (No ID)
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Team Assessments
          </h1>
          <p className="text-muted-foreground">
            Manage and review performance evaluations for your team.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff or period..."
            className="pl-10 glass-panel"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Active Reviews Section */}
      <Card className="glass-panel border-border/30 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500/30 via-violet-500 to-violet-500/30" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-500" />
            Active Reviews
          </CardTitle>
          <CardDescription>
            Assessments waiting for your review or currently in progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Fetching team data...</p>
            </div>
          ) : activeAssessments.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground">
                No active reviews pending.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAssessments.map((a) => (
                <div
                  key={a.id}
                  onClick={() => router.push(`/manager?id=${a.id}`)}
                  className="group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-background/50 border border-border/30 hover:border-violet-500/50 hover:bg-violet-500/[0.02] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground group-hover:text-violet-600 transition-colors">
                        {a.staff_name}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{a.period}</span>
                        <span>•</span>
                        <span>
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-4 md:mt-0">
                    <div className="hidden md:block text-right">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        Status
                      </p>
                      <div className="mt-1">{getStatusBadge(a.status)}</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed History Section */}
      <Card className="glass-panel border-border/30 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Completed History
          </CardTitle>
          <CardDescription>
            Finalized and acknowledged performance appraisals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : completedAssessments.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">No history yet</h3>
              <p className="text-sm text-muted-foreground">
                Completed assessments will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedAssessments.map((a) => (
                <div
                  key={a.id}
                  onClick={() => router.push(`/manager?id=${a.id}`)}
                  className="group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-background/50 border border-border/30 hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                        {a.staff_name}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{a.period}</span>
                        <span>•</span>
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Finalized
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-2"
                      onClick={(e) => handleDownloadPDF(e, a.id)}
                    >
                      <FileText className="h-4 w-4" />
                      Download Report
                    </Button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Check loading for detailed view
  if (assessmentId && !assessment && !assessmentLoading) {
    return <div>Assessment not found</div>;
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
      <Header />
      <main className="container relative px-4 py-8">{content}</main>
    </div>
  );
}

export default function ManagerPage() {
  return (
    <ProtectedRoute requiredRoles={["manager", "admin"]}>
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <ManagerContent />
      </Suspense>
    </ProtectedRoute>
  );
}

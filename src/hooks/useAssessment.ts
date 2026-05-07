import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface KPIData {
  id: string;
  name: string;
  description: string | null;
  evidence_guidance: string | null;
  trainings: string | null;
  rubric_4: string;
  rubric_3: string;
  rubric_2: string;
  rubric_1: string;
  score: number | 'X' | null;
  evidence: string | EvidenceItem[];
  // Manager data for review comparison
  managerScore?: number | 'X' | null;
  managerEvidence?: string | EvidenceItem[];
}

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

// Helper to check if indicator has valid evidence
export function hasValidEvidence(evidence: string | EvidenceItem[]): boolean {
  if (Array.isArray(evidence)) {
    return evidence.some(e => e.evidence.trim().length > 0);
  }
  return typeof evidence === 'string' && evidence.trim().length > 0;
}

export interface Assessment {
  id: string;
  period: string;
  status: string;
  template_id: string;
  staff_id: string;
  manager_id: string | null;
  director_id: string | null;
  staff_scores: Record<string, number | 'X'>;
  staff_evidence: Record<string, string>;
  manager_scores: Record<string, number | 'X'>;
  manager_evidence: Record<string, string>;
  final_score: number | null;
  final_grade: string | null;
  manager_notes: string | null;
  director_comments: string | null;
  staff_notes: string | null;
  return_feedback: string | null;
  returned_at: string | null;
  returned_by: string | null;
  staff_submitted_at: string | null;
  manager_reviewed_at: string | null;
  director_approved_at: string | null;
  created_at: string;
  staff_name?: string;
  staff_email?: string;
  manager_name?: string;
  director_name?: string;
  manager_job_title?: string;
  director_job_title?: string;
  staff_department?: string;
  staff_department_id?: string;
  staff_job_title?: string;
  staff_roles?: string[];
}

interface RubricTemplate {
  id: string;
  name: string;
  description: string | null;
  domains: {
    id: string;
    name: string;
    weight: number;
    sort_order: number;
    standards: {
      id: string;
      name: string;
      sort_order: number;
      kpis: {
        id: string;
        name: string;
        description: string | null;
        evidence_guidance: string | null;
        trainings: string | null;
        rubric_4: string;
        rubric_3: string;
        rubric_2: string;
        rubric_1: string;
        sort_order: number;
      }[];
    }[];
  }[];
}

export function useRubricTemplates() {
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await api.getRubrics();

    if (error) {
      console.error('Error fetching templates:', error);
      setLoading(false);
      return;
    }

    setTemplates((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return { templates, loading, refreshTemplates: fetchTemplates };
}

export function useAssessment(assessmentId?: string) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [managerFeedback, setManagerFeedback] = useState("");
  const [directorFeedback, setDirectorFeedback] = useState("");
  const [staffAcknowledgement, setStaffAcknowledgement] = useState("");

  useEffect(() => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }

    async function fetchAssessment() {
      const { data: assessmentData, error: assessmentError } = await api.getAssessment(assessmentId);

      if (assessmentError || !assessmentData) {
        console.error('Error fetching assessment:', assessmentError);
        setLoading(false);
        return;
      }

      setAssessment(assessmentData as Assessment);
      setManagerFeedback((assessmentData as any).manager_notes || "");
      setDirectorFeedback((assessmentData as any).director_comments || "");
      setStaffAcknowledgement((assessmentData as any).staff_notes || "");

      // Fetch rubric template with new hierarchy
      const template_id = (assessmentData as any).template_id;
      if (template_id) {
        const { data: rubricData, error: rubricError } = await api.getRubric(template_id);

        if (rubricError || !rubricData) {
          console.error('Error fetching rubric:', rubricError);
        } else {
          const data = assessmentData as any;
          const template = rubricData as any;

          const staffScores = (data.staff_scores || {}) as Record<string, number | 'X'>;
          const staffEvidence = (data.staff_evidence || {}) as Record<string, string | EvidenceItem[]>;
          const managerScores = (data.manager_scores || {}) as Record<string, number | 'X'>;
          const managerEvidence = (data.manager_evidence || {}) as Record<string, string | EvidenceItem[]>;

          const formattedDomains = (template.domains || [])
            .map((d: any) => ({
              id: d.id,
              name: d.name,
              weight: Number(d.weight || 0),
              standards: (d.standards || [])
                .map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  kpis: (s.kpis || [])
                    .map((k: any) => ({
                      id: k.id,
                      name: k.name,
                      description: k.description,
                      evidence_guidance: k.evidence_guidance,
                      trainings: k.trainings,
                      rubric_4: k.rubric_4,
                      rubric_3: k.rubric_3,
                      rubric_2: k.rubric_2,
                      rubric_1: k.rubric_1,
                      score: staffScores[k.id] ?? null,
                      evidence: staffEvidence[k.id] || '',
                      managerScore: managerScores[k.id] ?? null,
                      managerEvidence: managerEvidence[k.id] || '',
                    }))
                }))
            }));

          setDomains(formattedDomains);
        }
      }

      setLoading(false);
    }

    fetchAssessment();
  }, [assessmentId]);

  const saveDraft = async () => {
    if (!assessment) return;

    setSaving(true);
    const updates: any = {};

    // Determine if we are saving staff or manager data
    const isManagerView = assessment.status === 'self_submitted' || assessment.status === 'manager_reviewed';

    if (isManagerView) {
      const managerScores: Record<string, number | 'X'> = {};
      const managerEvidence: Record<string, string | EvidenceItem[]> = {};

      domains.forEach(domain => {
        domain.standards.forEach(standard => {
          standard.kpis.forEach(kpi => {
            if (kpi.managerScore !== null && kpi.managerScore !== undefined) {
              managerScores[kpi.id] = kpi.managerScore;
            }
            if (kpi.managerEvidence) {
              managerEvidence[kpi.id] = kpi.managerEvidence;
            }
          });
        });
      });

      updates.manager_scores = managerScores;
      updates.manager_evidence = managerEvidence;
      updates.manager_notes = managerFeedback;
    } else {
      const staffScores: Record<string, number | 'X'> = {};
      const staffEvidence: Record<string, string | EvidenceItem[]> = {};

      domains.forEach(domain => {
        domain.standards.forEach(standard => {
          standard.kpis.forEach(kpi => {
            if (kpi.score !== null) {
              staffScores[kpi.id] = kpi.score;
            }
            if (kpi.evidence) {
              staffEvidence[kpi.id] = kpi.evidence;
            }
          });
        });
      });

      updates.staff_scores = staffScores;
      updates.staff_evidence = staffEvidence;
    }

    const { error } = await api.updateAssessment(assessment.id, updates);

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save draft", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Draft saved successfully" });
    }
  };

  const submitAssessment = async () => {
    if (!assessment) return;

    setSaving(true);
    const staffScores: Record<string, number | 'X'> = {};
    const staffEvidence: Record<string, string | EvidenceItem[]> = {};

    domains.forEach(domain => {
      domain.standards.forEach(standard => {
        standard.kpis.forEach(kpi => {
          if (kpi.score !== null) {
            staffScores[kpi.id] = kpi.score;
          }
          if (kpi.evidence) {
            staffEvidence[kpi.id] = kpi.evidence;
          }
        });
      });
    });

    const { error } = await api.updateAssessment(assessment.id, {
      staff_scores: staffScores,
      staff_evidence: staffEvidence,
      status: 'self_submitted',
      staff_submitted_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to submit assessment", variant: "destructive" });
    } else {
      toast({ title: "Submitted", description: "Assessment submitted for manager review" });
      setAssessment(prev => prev ? { ...prev, status: 'self_submitted' } : null);
    }
  };

  const submitReview = async () => {
    if (!assessment) return;

    setSaving(true);
    const managerScores: Record<string, number | 'X'> = {};
    const managerEvidence: Record<string, string | EvidenceItem[]> = {};

    domains.forEach(domain => {
      domain.standards.forEach(standard => {
        standard.kpis.forEach(kpi => {
          if (kpi.managerScore !== null && kpi.managerScore !== undefined) {
            managerScores[kpi.id] = kpi.managerScore;
          }
          if (kpi.managerEvidence) {
            managerEvidence[kpi.id] = kpi.managerEvidence;
          }
        });
      });
    });

    // Calculate final score for performance review
    const finalScore = calculateWeightedScore(domains, 'manager');
    const finalGrade = finalScore !== null ? getGradeFromScore(finalScore) : null;

    if (!managerFeedback || !managerFeedback.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please provide overall feedback before submitting the review.",
        variant: "destructive"
      });
      setSaving(false);
      return;
    }

    const { error } = await api.updateAssessment(assessment.id, {
      manager_scores: managerScores,
      manager_evidence: managerEvidence,
      manager_notes: managerFeedback,
      status: 'manager_reviewed',
      manager_reviewed_at: new Date().toISOString(),
      final_score: finalScore,
      final_grade: finalGrade,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
    } else {
      toast({ title: "Submitted", description: "Review submitted successfully" });
      setAssessment(prev => prev ? { ...prev, status: 'manager_reviewed' } : null);
    }
  };

  const approveAssessment = async () => {
    if (!assessment) return;

    if (!directorFeedback || !directorFeedback.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please provide final comments before approving.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    // Collect current manager scores and evidence to ensure they are saved
    const managerScores: Record<string, number | 'X'> = {};
    const managerEvidence: Record<string, string | EvidenceItem[]> = {};

    domains.forEach(domain => {
      domain.standards.forEach(standard => {
        standard.kpis.forEach(kpi => {
          if (kpi.managerScore !== null && kpi.managerScore !== undefined) {
            managerScores[kpi.id] = kpi.managerScore;
          }
          if (kpi.managerEvidence) {
            managerEvidence[kpi.id] = kpi.managerEvidence;
          }
        });
      });
    });

    const finalScore = calculateWeightedScore(domains, 'manager');
    const finalGrade = finalScore !== null ? getGradeFromScore(finalScore) : null;

    const { error } = await api.updateAssessment(assessment.id, {
      status: 'director_approved',
      director_comments: directorFeedback,
      director_approved_at: new Date().toISOString(),
      final_score: finalScore,
      final_grade: finalGrade,
      manager_scores: managerScores,
      manager_evidence: managerEvidence
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to approve assessment", variant: "destructive" });
    } else {
      toast({ title: "Approved", description: "Assessment approved successfully" });
      setAssessment(prev => prev ? { ...prev, status: 'director_approved' } : null);
    }
  };

  const acknowledgeAssessment = async () => {
    if (!assessment) return;

    if (!staffAcknowledgement || !staffAcknowledgement.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please provide your final comments/feedback before acknowledging.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    const finalScore = calculateWeightedScore(domains, 'manager');
    const finalGrade = finalScore !== null ? getGradeFromScore(finalScore) : null;

    const { error } = await api.updateAssessment(assessment.id, {
      status: 'acknowledged',
      staff_notes: staffAcknowledgement,
      final_score: finalScore,
      final_grade: finalGrade,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to acknowledge assessment", variant: "destructive" });
    } else {
      toast({ title: "Acknowledged", description: "Assessment acknowledged successfully" });
      setAssessment(prev => prev ? { ...prev, status: 'acknowledged' } : null);
    }
  };

  const updateKPI = (kpiId: string, updates: Partial<KPIData>) => {
    setDomains(prev => prev.map(domain => ({
      ...domain,
      standards: domain.standards.map(standard => ({
        ...standard,
        kpis: standard.kpis.map(kpi => {
          if (kpi.id !== kpiId) return kpi;
          return { ...kpi, ...updates };
        })
      }))
    })));
  };

  const updateAssessmentStatus = (status: string) => {
    setAssessment(prev => prev ? { ...prev, status } : null);
  };

  const deleteAssessment = async () => {
    if (!assessment) return;

    setSaving(true);
    const { error } = await api.deleteAssessment(assessment.id);
    setSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message || "Failed to delete assessment", variant: "destructive" });
      return false;
    } else {
      toast({ title: "Deleted", description: "Assessment deleted successfully" });
      return true;
    }
  };

  const returnAssessment = async (returnFeedback: string, returnedBy: string) => {
    if (!assessment) return false;

    if (!returnFeedback || !returnFeedback.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please provide feedback explaining why the assessment is being returned.",
        variant: "destructive"
      });
      return false;
    }

    setSaving(true);

    const { error } = await api.updateAssessment(assessment.id, {
      status: 'returned',
      return_feedback: returnFeedback,
      returned_at: new Date().toISOString(),
      returned_by: returnedBy,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to return assessment", variant: "destructive" });
      return false;
    } else {
      toast({ title: "Returned", description: "Assessment returned to staff for revision" });
      setAssessment(prev => prev ? { ...prev, status: 'returned', return_feedback: returnFeedback } : null);
      return true;
    }
  };

  return {
    assessment,
    domains,
    loading,
    saving,
    saveDraft,
    submitAssessment,
    submitReview,
    updateKPI,
    updateAssessmentStatus,
    managerFeedback,
    setManagerFeedback,
    directorFeedback,
    setDirectorFeedback,
    staffAcknowledgement,
    setStaffAcknowledgement,
    approveAssessment,
    acknowledgeAssessment,
    deleteAssessment,
    returnAssessment,
  };
}

export function useMyAssessments() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchAssessments() {
      const { data, error } = await api.getAssessments({ staffId: user!.id });

      if (error) {
        console.error('Error fetching assessments:', error);
      } else {
        setAssessments((data as Assessment[]) || []);
      }
      setLoading(false);
    }

    fetchAssessments();
  }, [user]);

  const createAssessment = async (templateId: string, period: string) => {
    if (!user) return null;

    const { data, error } = await api.createAssessment({
      template_id: templateId,
      period,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create assessment", variant: "destructive" });
      return null;
    }

    const newAssessment = data as Assessment;
    setAssessments(prev => [newAssessment, ...prev]);
    return newAssessment;
  };

  const deleteAssessment = async (id: string) => {
    const { error } = await api.deleteAssessment(id);
    if (error) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
      return false;
    }
    setAssessments(prev => prev.filter(a => a.id !== id));
    toast({ title: "Deleted", description: "Assessment deleted" });
    return true;
  };

  return { assessments, loading, createAssessment, deleteAssessment };
}

export function useTeamAssessments() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<(Assessment & { staff_name?: string; staff_email?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchTeamAssessments() {
      // API currently handles general listing, we might need more specific filters later
      // For now, get all assessments and we'll filter them as needed or expect the API to handle permissions
      const { data, error } = await api.getAssessments();

      if (error) {
        console.error('Error fetching team assessments:', error);
      } else {
        setAssessments((data as any[]) || []);
      }
      setLoading(false);
    }

    fetchTeamAssessments();
  }, [user]);

  return { assessments, loading };
}

export function calculateWeightedScore(domains: DomainData[] | undefined | null, type: 'staff' | 'manager' = 'staff'): number | null {
  if (!domains || !Array.isArray(domains)) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const domain of domains) {
    let domainKPIs: KPIData[] = [];
    domain.standards.forEach(s => {
      domainKPIs = [...domainKPIs, ...s.kpis];
    });

    const scoredKPIs = domainKPIs.filter(kpi => {
      const score = type === 'staff' ? kpi.score : kpi.managerScore;
      return score !== null && score !== undefined && score !== 'X';
    });

    if (scoredKPIs.length === 0) continue;

    const domainAvg = scoredKPIs.reduce((sum, kpi) => {
      const score = type === 'staff' ? kpi.score : kpi.managerScore;
      return sum + (Number(score) || 0);
    }, 0) / scoredKPIs.length;

    weightedSum += domainAvg * domain.weight;
    totalWeight += domain.weight;
  }

  if (totalWeight === 0) {
    // If no weights defined but there are scored KPIs, return simple average of all scored KPIs
    let allScoredKPIs: number[] = [];
    domains.forEach(d => {
      d.standards.forEach(s => {
        s.kpis.forEach(kpi => {
          const score = type === 'staff' ? kpi.score : kpi.managerScore;
          if (score !== null && score !== undefined && score !== 'X') {
            allScoredKPIs.push(Number(score));
          }
        });
      });
    });

    if (allScoredKPIs.length === 0) return null;
    return allScoredKPIs.reduce((a, b) => a + b, 0) / allScoredKPIs.length;
  }

  return weightedSum / totalWeight;
}

export interface PerformanceDetails {
  grade: string;
  label: string;
  description: string;
  bonusPayout: number;
}

export function getPerformanceDetails(score: number): PerformanceDetails {
  if (score >= 3.9) return {
    grade: "★",
    label: "Exemplary",
    description: "Outstanding performance that exceeds expectations across all domains. Recognizes employees who consistently demonstrate innovation, leadership, and exceptional contributions.",
    bonusPayout: 100
  };
  if (score >= 3.6) return {
    grade: "◆",
    label: "Trail Blazers",
    description: "High-performing individuals who go beyond role expectations and actively contribute to team and organizational success. Strong candidates for leadership development.",
    bonusPayout: 90
  };
  if (score >= 3.4) return {
    grade: "▲",
    label: "Rising Star",
    description: "Employees showing significant growth and potential. Consistently meets expectations with notable areas of excellence. On track for advancement with continued development.",
    bonusPayout: 80
  };
  if (score >= 3.2) return {
    grade: "●",
    label: "Solid Foundation",
    description: "Reliably meets role expectations and demonstrates competence across key performance areas. A stable contributor who forms the backbone of the team.",
    bonusPayout: 65
  };
  if (score >= 3.0) return {
    grade: "◐",
    label: "Developing Under Guidance",
    description: "Entry level grade. Contract employees are expected to progress to Solid Foundation within 1 year, permanent employees within 2 years, or risk being bumped down to Needs Improvement.",
    bonusPayout: 50
  };
  if (score >= 2.8) return {
    grade: "○",
    label: "Needs Improvement",
    description: "This grade can be given a maximum of two times. By the third PA, staff must have progressed to the next grade, or they will be bumped down to Performance Management.",
    bonusPayout: 40
  };
  if (score >= 2.6) return {
    grade: "!",
    label: "Performance Management",
    description: "At least 6 months, but no more than 1 year, depending on urgency. If staff does not improve, they will likely be let go from their role in the school.",
    bonusPayout: 10
  };
  return {
    grade: "—",
    label: "Below Threshold",
    description: "Performance is critically below acceptable standards. Immediate intervention and a formal performance improvement plan are required.",
    bonusPayout: 0
  };
}

export function getGradeFromScore(score: number): string {
  return getPerformanceDetails(score).label;
}

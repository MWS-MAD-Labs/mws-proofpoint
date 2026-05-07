'use client';

// WorkflowEditor.tsx — Milestone 2
//
// Perubahan dari Milestone 1:
//   ✅ Satu dept role bisa punya MULTIPLE workflows (observation + appraisal)
//   ✅ Step pertama TIDAK lagi hardcode "Self Assessment"
//   ✅ Support workflow type CLASSROOM_OBSERVATION
//   ✅ Admin bisa buat workflow "Classroom Observation" dan assign ke role
//   ✅ Admin bisa link observation rubric per assignment
//   ✅ Admin bisa konfigurasi: manager fills → staff acknowledges

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDown,
  Plus,
  Trash2,
  Loader2,
  GitBranch,
  CheckCircle2,
  FileSearch,
  CheckCheck,
  Layout,
  ShieldCheck,
  Link2,
  Unlink,
  Eye,
  ClipboardCheck,
} from 'lucide-react';
import { api } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Department {
  id:               string;
  name:             string;
  hierarchy_level?: 'root' | 'department' | 'subdepartment';
}

interface DepartmentRole {
  id:              string;
  department_id:   string | null;
  role:            string;
  department_name: string | null;
  name?:           string | null;
}

interface WorkflowStep {
  id:          string;
  stepOrder:   number;
  actorRole:   string;
  actionType:  'FILL_FORM' | 'ACKNOWLEDGE' | 'REVIEW' | 'APPROVE';
  description: string | null;
}

interface WorkflowDefinition {
  id:          string;
  name:        string;
  type:        'KPI_APPRAISAL' | 'CLASSROOM_OBSERVATION' | 'GENERIC';
  description: string | null;
  steps:       WorkflowStep[];
}

interface RoleWorkflowAssignment {
  id:               string;
  departmentRoleId: string;
  workflowId:       string;
  rubricId:         string | null;
  isActive:         boolean;
  workflow:         WorkflowDefinition;
  rubric?:          { id: string; name: string } | null;
}

interface RubricTemplate {
  id:           string;
  name:         string;
  templateType?: string;
}

interface WorkflowEditorProps {
  departments: Department[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: 'FILL_FORM',   label: 'Fill Form',   icon: FileSearch,    color: 'text-blue-500',   desc: 'Actor fills in form/assessment' },
  { value: 'REVIEW',      label: 'Review',       icon: Eye,           color: 'text-green-500',  desc: 'Actor performs review' },
  { value: 'APPROVE',     label: 'Approve',      icon: CheckCircle2,  color: 'text-purple-500', desc: 'Actor gives approval' },
  { value: 'ACKNOWLEDGE', label: 'Acknowledge',  icon: ClipboardCheck,color: 'text-amber-500',  desc: 'Actor acknowledges/signs the result' },
] as const;

const WORKFLOW_TYPES = [
  { value: 'KPI_APPRAISAL',        label: 'KPI Appraisal',        color: 'bg-blue-100 text-blue-700'   },
  { value: 'CLASSROOM_OBSERVATION', label: 'Classroom Observation', color: 'bg-green-100 text-green-700' },
  { value: 'GENERIC',              label: 'Generic',               color: 'bg-gray-100 text-gray-700'   },
] as const;

const ACTOR_ROLES = [
  { value: 'staff',      label: 'Staff'      },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager',    label: 'Manager'    },
  { value: 'director',   label: 'Director'   },
  { value: 'admin',      label: 'Admin'      },
];

// Default steps untuk tiap workflow type
const DEFAULT_STEPS: Record<string, { actorRole: string; actionType: 'FILL_FORM' | 'ACKNOWLEDGE' | 'REVIEW' | 'APPROVE'; description: string }[]> = {
  KPI_APPRAISAL: [
    { actorRole: 'staff',    actionType: 'FILL_FORM',   description: 'Staff fills in self-assessment' },
    { actorRole: 'manager',  actionType: 'REVIEW',      description: 'Manager performs review and scoring' },
    { actorRole: 'director', actionType: 'APPROVE',     description: 'Director approves the result' },
    { actorRole: 'staff',    actionType: 'ACKNOWLEDGE', description: 'Staff acknowledges appraisal result' },
  ],
  CLASSROOM_OBSERVATION: [
    { actorRole: 'manager',  actionType: 'FILL_FORM',   description: 'Manager/Observer fills in observation form' },
    { actorRole: 'staff',    actionType: 'ACKNOWLEDGE', description: 'Staff acknowledges observation result' },
  ],
  GENERIC: [
    { actorRole: 'staff',   actionType: 'FILL_FORM',   description: 'Fill in form' },
    { actorRole: 'manager', actionType: 'APPROVE',     description: 'Give approval' },
  ],
};

// ── Component ──────────────────────────────────────────────────────────────────

export function WorkflowEditor({ departments }: WorkflowEditorProps) {

  // ── State ──
  const [departmentRoles, setDepartmentRoles]       = useState<DepartmentRole[]>([]);
  const [selectedDeptRoleId, setSelectedDeptRoleId] = useState('');
  const [workflows, setWorkflows]                   = useState<WorkflowDefinition[]>([]);
  const [assignments, setAssignments]               = useState<RoleWorkflowAssignment[]>([]);
  const [rubrics, setRubrics]                       = useState<RubricTemplate[]>([]);
  const [loading, setLoading]                       = useState(false);
  const [saving, setSaving]                         = useState(false);
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);

  // New workflow form
  const [showNewWorkflow, setShowNewWorkflow]   = useState(false);
  const [newWorkflowName, setNewWorkflowName]   = useState('');
  const [newWorkflowType, setNewWorkflowType]   = useState<'KPI_APPRAISAL' | 'CLASSROOM_OBSERVATION' | 'GENERIC'>('CLASSROOM_OBSERVATION');
  const [newWorkflowDesc, setNewWorkflowDesc]   = useState('');

  // Workflow to assign
  const [workflowToAssign, setWorkflowToAssign] = useState('');

  // ── Fetch initial data ──
  useEffect(() => {
    const fetchData = async () => {
      const [drRes, rRes, wfRes] = await Promise.all([
        api.getDepartmentRoles(),
        api.getRubrics(),
        api.getWorkflowDefinitions(),
      ]);
      if (drRes.data) setDepartmentRoles(drRes.data as DepartmentRole[]);
      if (rRes.data)  setRubrics(rRes.data as RubricTemplate[]);
      if (wfRes.data) setWorkflows(wfRes.data as WorkflowDefinition[]);
    };
    void fetchData();
  }, []);

  // ── Fetch assignments for selected dept role ──
  const fetchAssignments = useCallback(async (deptRoleId: string) => {
    if (!deptRoleId) { setAssignments([]); return; }
    setLoading(true);
    const { data } = await api.getRoleWorkflowAssignments(deptRoleId);
    if (data) setAssignments(data as RoleWorkflowAssignment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAssignments(selectedDeptRoleId);
  }, [selectedDeptRoleId, fetchAssignments]);

  // ── Helpers ──
  const getActionTypeInfo = (actionType: string) =>
    ACTION_TYPES.find(a => a.value === actionType) ?? ACTION_TYPES[0]!;

  const getWorkflowTypeInfo = (type: string) =>
    WORKFLOW_TYPES.find(t => t.value === type) ?? WORKFLOW_TYPES[2]!;

  const selectedDeptRole = departmentRoles.find(dr => dr.id === selectedDeptRoleId);

  // ── Dept Role CRUD ──
  const handleCreateDeptRole = async (departmentId: string, role: string) => {
    setSaving(true);
    const { data, error } = await api.createDepartmentRole({ department_id: departmentId, role });
    if (!error && data) {
      const newRole = data as DepartmentRole;
      setDepartmentRoles(prev => [...prev, newRole]);
      setSelectedDeptRoleId(newRole.id);
    }
    setSaving(false);
  };

  const handleDeleteDeptRole = async () => {
    if (!selectedDeptRoleId || !confirm('Delete this department role and all its assignments?')) return;
    setSaving(true);
    const { error } = await api.deleteDepartmentRole(selectedDeptRoleId);
    if (!error) {
      setDepartmentRoles(prev => prev.filter(dr => dr.id !== selectedDeptRoleId));
      setSelectedDeptRoleId('');
    }
    setSaving(false);
  };

  // ── Workflow Definition CRUD ──
  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) return;
    setSaving(true);

    const defaultSteps = DEFAULT_STEPS[newWorkflowType] ?? DEFAULT_STEPS['GENERIC']!;

    const { data, error } = await api.createWorkflowDefinition({
      name:        newWorkflowName.trim(),
      type:        newWorkflowType,
      description: newWorkflowDesc.trim() || undefined,
      steps:       defaultSteps,
    });

    if (!error && data) {
      const newWf = data as WorkflowDefinition;
      setWorkflows(prev => [newWf, ...prev]);
      setExpandedWorkflowId(newWf.id);
      setShowNewWorkflow(false);
      setNewWorkflowName('');
      setNewWorkflowDesc('');
    }
    setSaving(false);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Delete this workflow? Assignments using it must be removed first.')) return;
    setSaving(true);
    const { error } = await api.deleteWorkflowDefinition(workflowId);
    if (!error) {
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      if (expandedWorkflowId === workflowId) setExpandedWorkflowId(null);
    }
    setSaving(false);
  };

  // ── Step CRUD ──
  const handleUpdateStep = async (workflowId: string, stepIndex: number, field: 'actorRole' | 'actionType', value: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    const updatedSteps = workflow.steps.map((s, i) =>
      i === stepIndex ? { ...s, [field]: value } : s
    );

    setSaving(true);
    const { data, error } = await api.updateWorkflowDefinition(workflowId, {
      steps: updatedSteps.map(s => ({
        actorRole:   s.actorRole,
        actionType:  s.actionType,
        description: s.description ?? undefined,
      })),
    });
    if (!error && data) {
      setWorkflows(prev => prev.map(w => w.id === workflowId ? data as WorkflowDefinition : w));
    }
    setSaving(false);
  };

  const handleAddStep = async (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    // ✅ Milestone 2: no hardcoded step — admin freely chooses actor and action
    const newStep = {
      actorRole:   'manager',
      actionType:  'FILL_FORM' as const,
      description: undefined,
    };
    const updatedSteps = [
      ...workflow.steps.map(s => ({
        actorRole:   s.actorRole,
        actionType:  s.actionType,
        description: s.description ?? undefined,
      })),
      newStep,
    ];

    setSaving(true);
    const { data, error } = await api.updateWorkflowDefinition(workflowId, { steps: updatedSteps });
    if (!error && data) {
      setWorkflows(prev => prev.map(w => w.id === workflowId ? data as WorkflowDefinition : w));
    }
    setSaving(false);
  };

  const handleRemoveStep = async (workflowId: string, stepIndex: number) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    const updatedSteps = workflow.steps
      .filter((_, i) => i !== stepIndex)
      .map(s => ({
        actorRole:   s.actorRole,
        actionType:  s.actionType,
        description: s.description ?? undefined,
      }));

    setSaving(true);
    const { data, error } = await api.updateWorkflowDefinition(workflowId, { steps: updatedSteps });
    if (!error && data) {
      setWorkflows(prev => prev.map(w => w.id === workflowId ? data as WorkflowDefinition : w));
    }
    setSaving(false);
  };

  // ── Assignment CRUD ──
  // ✅ Milestone 2: one role can have MULTIPLE workflow assignments
  const handleAssignWorkflow = async () => {
    if (!selectedDeptRoleId || !workflowToAssign) return;
    setSaving(true);
    const { data, error } = await api.createRoleWorkflowAssignment({
      departmentRoleId: selectedDeptRoleId,
      workflowId:       workflowToAssign,
    });
    if (!error && data) {
      setAssignments(prev => [...prev, data as RoleWorkflowAssignment]);
      setWorkflowToAssign('');
    }
    setSaving(false);
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('Remove this workflow assignment?')) return;
    setSaving(true);
    const { error } = await api.deleteRoleWorkflowAssignment(assignmentId);
    if (!error) setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    setSaving(false);
  };

  const handleAssignRubric = async (assignmentId: string, rubricId: string) => {
    setSaving(true);
    const { data, error } = await api.updateRoleWorkflowAssignment(assignmentId, {
      rubricId: rubricId === 'none' ? null : rubricId,
    });
    if (!error && data) {
      setAssignments(prev => prev.map(a => a.id === assignmentId ? data as RoleWorkflowAssignment : a));
    }
    setSaving(false);
  };

  const handleToggleActive = async (assignmentId: string, isActive: boolean) => {
    setSaving(true);
    const { data, error } = await api.updateRoleWorkflowAssignment(assignmentId, { isActive });
    if (!error && data) {
      setAssignments(prev => prev.map(a => a.id === assignmentId ? data as RoleWorkflowAssignment : a));
    }
    setSaving(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ══ Panel 1: Department Role Selector ══════════════════════════════ */}
      <Card className="glass-panel border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5 text-purple-500" />
            Workflow Configuration
          </CardTitle>
          <CardDescription>
            Assign one or more workflow definitions to a department role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Department Role</label>
              <Select value={selectedDeptRoleId} onValueChange={setSelectedDeptRoleId}>
                <SelectTrigger className="glass-panel">
                  <SelectValue placeholder="Select a department role" />
                </SelectTrigger>
                <SelectContent className="glass-panel-strong">
                  {departmentRoles.map(dr => (
                    <SelectItem key={dr.id} value={dr.id}>
                      {dr.name ?? `${dr.department_name ?? 'Global'} — ${dr.role}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Or Create New</label>
              <Select
                onValueChange={(value) => {
                  const parts  = value.split('|');
                  const deptId = parts[0];
                  const role   = parts[1];
                  if (role && deptId !== undefined) {
                    void handleCreateDeptRole(deptId === 'none' ? '' : deptId, role);
                  }
                }}
              >
                <SelectTrigger className="glass-panel">
                  <SelectValue placeholder="Add role..." />
                </SelectTrigger>
                <SelectContent className="glass-panel-strong">
                  <SelectItem value="none|director">Global — Director</SelectItem>
                  <SelectItem value="none|admin">Global — Admin</SelectItem>
                  {departments.flatMap(dept => {
                    const level = dept.hierarchy_level ?? 'root';
                    const rolesForLevel = level === 'subdepartment'
                      ? ['supervisor', 'staff']
                      : ['manager', 'staff'];
                    return rolesForLevel
                      .filter(role => !departmentRoles.some(dr =>
                        dr.department_id === dept.id && dr.role === role
                      ))
                      .map(role => (
                        <SelectItem key={`${dept.id}|${role}`} value={`${dept.id}|${role}`}>
                          {dept.name} — <span className="capitalize">{role}</span>
                        </SelectItem>
                      ));
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══ Panel 2: Assignments for selected dept role ═════════════════════ */}
      {selectedDeptRoleId && (
        <Card className="glass-panel border-border/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Workflows for{' '}
                  <Badge variant="secondary" className="ml-1 capitalize">
                    {selectedDeptRole?.name ?? `${selectedDeptRole?.department_name ?? 'Global'} — ${selectedDeptRole?.role}`}
                  </Badge>
                </CardTitle>
                {/* ✅ Milestone 2: multiple workflows per role are supported */}
                <CardDescription>
                  A role can have multiple workflows — e.g. one for KPI Appraisal and one for Classroom Observation
                </CardDescription>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={handleDeleteDeptRole}
                disabled={saving}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />Delete Role
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Current assignments */}
                {assignments.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                    No workflow assigned yet. Assign one below.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map(a => {
                      const typeInfo = getWorkflowTypeInfo(a.workflow.type);
                      return (
                        <div key={a.id} className={`p-4 rounded-lg border space-y-3 transition-all ${a.isActive ? 'border-border/50 bg-muted/10' : 'border-border/20 bg-muted/5 opacity-60'}`}>
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-semibold text-sm">{a.workflow.name}</span>
                              <Badge className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</Badge>
                              <Badge variant={a.isActive ? 'default' : 'outline'} className="text-xs">
                                {a.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 text-xs"
                                onClick={() => void handleToggleActive(a.id, !a.isActive)}
                                disabled={saving}
                              >
                                {a.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => void handleUnassign(a.id)}
                                disabled={saving}
                              >
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Rubric assignment */}
                          <div className="flex items-center gap-3">
                            <Layout className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1">
                              <Select
                                value={a.rubricId ?? 'none'}
                                onValueChange={(val) => void handleAssignRubric(a.id, val)}
                              >
                                <SelectTrigger className="h-8 text-sm bg-background border-border/50">
                                  <SelectValue placeholder="Link rubric..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No rubric linked</SelectItem>
                                  {/* ✅ Filter rubrics by workflow type */}
                                  {rubrics
                                    .filter(r => {
                                      if (a.workflow.type === 'CLASSROOM_OBSERVATION') {
                                        return r.templateType === 'CLASSROOM_OBSERVATION';
                                      }
                                      if (a.workflow.type === 'KPI_APPRAISAL') {
                                        return r.templateType === 'KPI_APPRAISAL';
                                      }
                                      return true;
                                    })
                                    .map(r => (
                                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                              {a.rubric && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Linked: <span className="font-medium text-foreground">{a.rubric.name}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Steps preview */}
                          <div className="ml-6 space-y-1 pt-1 border-t border-border/30">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Steps:</p>
                            {a.workflow.steps.map((step, i) => {
                              const info = getActionTypeInfo(step.actionType);
                              return (
                                <div key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-mono w-4 text-center text-muted-foreground/50">{i + 1}</span>
                                  <info.icon className={`h-3 w-3 ${info.color}`} />
                                  <span className="capitalize font-medium text-foreground">{step.actorRole}</span>
                                  <span className="text-muted-foreground/50">→</span>
                                  <span>{info.label}</span>
                                  {step.description && (
                                    <span className="text-muted-foreground/60 italic truncate">({step.description})</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Assign workflow */}
                <div className="pt-2 border-t border-border/30">
                  <p className="text-sm font-medium mb-2">
                    Assign Workflow
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      (multiple workflows allowed per role)
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Select value={workflowToAssign} onValueChange={setWorkflowToAssign}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="Select workflow to assign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workflows.map(w => {
                          const typeInfo = getWorkflowTypeInfo(w.type);
                          const alreadyAssigned = assignments.some(a => a.workflowId === w.id);
                          return (
                            <SelectItem key={w.id} value={w.id} disabled={alreadyAssigned}>
                              <div className="flex items-center gap-2">
                                <span>{w.name}</span>
                                <Badge className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</Badge>
                                {alreadyAssigned && <span className="text-xs text-muted-foreground">(assigned)</span>}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => void handleAssignWorkflow()}
                      disabled={!workflowToAssign || saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                      Assign
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══ Panel 3: Workflow Definitions Manager ═══════════════════════════ */}
      <Card className="glass-panel border-border/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                Workflow Definitions
              </CardTitle>
              <CardDescription>
                Create reusable workflow templates. Steps are fully configurable — no assumptions about who goes first.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => { setShowNewWorkflow(true); setNewWorkflowType('CLASSROOM_OBSERVATION'); }}
              disabled={saving || showNewWorkflow}
            >
              <Plus className="h-4 w-4 mr-1" />New Workflow
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Create new workflow form */}
          {showNewWorkflow && (
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
              <p className="text-sm font-semibold text-primary">New Workflow Definition</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Workflow name (e.g. Classroom Observation)"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="h-9"
                />
                <Select value={newWorkflowType} onValueChange={(v) => setNewWorkflowType(v as typeof newWorkflowType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <Badge className={`text-xs ${t.color}`}>{t.label}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Description (optional)..."
                value={newWorkflowDesc}
                onChange={(e) => setNewWorkflowDesc(e.target.value)}
                className="h-16 text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Default steps will be created automatically based on the workflow type. You can edit them after creation.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowNewWorkflow(false); setNewWorkflowName(''); setNewWorkflowDesc(''); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void handleCreateWorkflow()} disabled={!newWorkflowName.trim() || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow list */}
          {workflows.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm">
              No workflow definitions. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map(workflow => {
                const typeInfo    = getWorkflowTypeInfo(workflow.type);
                const isExpanded  = expandedWorkflowId === workflow.id;
                const assignCount = assignments.filter(a => a.workflowId === workflow.id).length;

                return (
                  <div key={workflow.id} className="rounded-lg border border-border/50 overflow-hidden">
                    {/* Header */}
                    <div
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5 border-b border-primary/10' : 'bg-muted/20 hover:bg-muted/40'}`}
                      onClick={() => setExpandedWorkflowId(isExpanded ? null : workflow.id)}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <GitBranch className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold text-sm">{workflow.name}</span>
                        <Badge className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</Badge>
                        <Badge variant="secondary" className="text-xs">{workflow.steps.length} steps</Badge>
                        {assignCount > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            {assignCount} role{assignCount > 1 ? 's' : ''} assigned
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => { e.stopPropagation(); void handleDeleteWorkflow(workflow.id); }}
                        disabled={saving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Steps editor */}
                    {isExpanded && (
                      <div className="p-4 space-y-2 bg-background">
                        {workflow.description && (
                          <p className="text-xs text-muted-foreground italic mb-3">{workflow.description}</p>
                        )}

                        {/* ✅ Milestone 2: no hardcoded first step — all steps are admin-configurable */}
                        {workflow.steps.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No steps yet. Add one below.</p>
                        ) : (
                          workflow.steps.map((step, idx) => {
                            const info = getActionTypeInfo(step.actionType);
                            return (
                              <div key={step.id}>
                                {idx > 0 && (
                                  <div className="flex justify-center py-1">
                                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/40">
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold shrink-0">
                                    {idx + 1}
                                  </div>
                                  {/* Actor Role */}
                                  <Select
                                    value={step.actorRole}
                                    onValueChange={val => void handleUpdateStep(workflow.id, idx, 'actorRole', val)}
                                  >
                                    <SelectTrigger className="h-8 text-sm flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACTOR_ROLES.map(r => (
                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {/* Action Type */}
                                  <Select
                                    value={step.actionType}
                                    onValueChange={val => void handleUpdateStep(workflow.id, idx, 'actionType', val)}
                                  >
                                    <SelectTrigger className="h-8 text-sm flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACTION_TYPES.map(at => (
                                        <SelectItem key={at.value} value={at.value}>
                                          <div className="flex items-center gap-2">
                                            <at.icon className={`h-3.5 w-3.5 ${at.color}`} />
                                            <div>
                                              <div>{at.label}</div>
                                              <div className="text-xs text-muted-foreground">{at.desc}</div>
                                            </div>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <info.icon className={`h-4 w-4 ${info.color} shrink-0`} />
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={() => void handleRemoveStep(workflow.id, idx)}
                                    disabled={saving}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}

                        <div className="flex justify-center pt-2">
                          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </div>

                        <Button
                          variant="outline" size="sm"
                          className="w-full border-dashed text-xs h-8"
                          onClick={() => void handleAddStep(workflow.id)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                          Add Step
                        </Button>

                        {/* Quick template untuk Classroom Observation */}
                        {workflow.type === 'CLASSROOM_OBSERVATION' && workflow.steps.length === 0 && (
                          <div className="pt-2 border-t border-border/30">
                            <p className="text-xs text-muted-foreground mb-2">Quick template:</p>
                            <Button
                              variant="outline" size="sm" className="text-xs h-7"
                              onClick={async () => {
                                setSaving(true);
                                const { data, error } = await api.updateWorkflowDefinition(workflow.id, {
                                  steps: [
                                    { actorRole: 'manager', actionType: 'FILL_FORM',   description: 'Manager/Observer fills in observation form' },
                                    { actorRole: 'staff',   actionType: 'ACKNOWLEDGE', description: 'Staff acknowledges observation result' },
                                  ],
                                });
                                if (!error && data) setWorkflows(prev => prev.map(w => w.id === workflow.id ? data as WorkflowDefinition : w));
                                setSaving(false);
                              }}
                            >
                              <CheckCheck className="h-3 w-3 mr-1" />
                              Manager fills → Staff acknowledges
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
        {ACTION_TYPES.map(at => (
          <div key={at.value} className="flex items-center gap-1.5">
            <at.icon className={`h-3.5 w-3.5 ${at.color}`} />
            <span><strong>{at.label}</strong> — {at.desc}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
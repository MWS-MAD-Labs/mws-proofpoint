'use client';

// WorkflowEditor.tsx
// ✅ MIGRATED: dari legacy department_roles/approval_workflow
//              ke model baru WorkflowDefinition + RoleWorkflowAssignment
//
// Model baru:
//   DepartmentRole          → /api/admin/department-roles
//   WorkflowDefinition      → /api/admin/workflow-definitions
//   RoleWorkflowAssignment  → /api/admin/role-workflow-assignments

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  User,
  CheckCircle2,
  FileSearch,
  CheckCheck,
  Layout,
  ShieldCheck,
  Link2,
  Unlink,
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
  id:   string;
  name: string;
}

interface WorkflowEditorProps {
  departments: Department[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: 'FILL_FORM',   label: 'Fill Form',   icon: FileSearch,   color: 'text-blue-500'   },
  { value: 'REVIEW',      label: 'Review',       icon: CheckCircle2, color: 'text-green-500'  },
  { value: 'APPROVE',     label: 'Approve',      icon: CheckCheck,   color: 'text-purple-500' },
  { value: 'ACKNOWLEDGE', label: 'Acknowledge',  icon: User,         color: 'text-amber-500'  },
] as const;

const ACTOR_ROLES = ['staff', 'supervisor', 'manager', 'director', 'admin'];

const WORKFLOW_TYPES = [
  { value: 'KPI_APPRAISAL',        label: 'KPI Appraisal'        },
  { value: 'CLASSROOM_OBSERVATION', label: 'Classroom Observation' },
  { value: 'GENERIC',              label: 'Generic'              },
] as const;

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

  // For creating new workflow
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowType, setNewWorkflowType] = useState<'KPI_APPRAISAL' | 'CLASSROOM_OBSERVATION' | 'GENERIC'>('KPI_APPRAISAL');
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);

  // Selected workflow for editing
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

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

  // ── Fetch assignments when dept role changes ──
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
  const getActionTypeInfo = (actionType: string) => {
    return ACTION_TYPES.find(a => a.value === actionType) ?? ACTION_TYPES[0];
  };

  const selectedDeptRole = departmentRoles.find(dr => dr.id === selectedDeptRoleId);
  const activeAssignment = assignments.find(a => a.isActive);
  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
    ?? activeAssignment?.workflow;

  // ── Dept Role CRUD ──
  const handleCreateDeptRole = async (departmentId: string, role: string) => {
    setSaving(true);
    const { data, error } = await api.createDepartmentRole({
      department_id: departmentId,
      role,
    });
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
    const { data, error } = await api.createWorkflowDefinition({
      name: newWorkflowName.trim(),
      type: newWorkflowType,
      steps: [
        { actorRole: 'staff',    actionType: 'FILL_FORM',   description: 'Staff fills self-assessment' },
        { actorRole: 'manager',  actionType: 'REVIEW',      description: 'Manager reviews' },
        { actorRole: 'director', actionType: 'APPROVE',     description: 'Director approves' },
        { actorRole: 'admin',    actionType: 'REVIEW',      description: 'Admin releases' },
        { actorRole: 'staff',    actionType: 'ACKNOWLEDGE', description: 'Staff acknowledges' },
      ],
    });
    if (!error && data) {
      const newWf = data as WorkflowDefinition;
      setWorkflows(prev => [newWf, ...prev]);
      setSelectedWorkflowId(newWf.id);
      setShowNewWorkflow(false);
      setNewWorkflowName('');
    }
    setSaving(false);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Delete this workflow definition? Assignments using it must be removed first.')) return;
    setSaving(true);
    const { error } = await api.deleteWorkflowDefinition(workflowId);
    if (!error) {
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      if (selectedWorkflowId === workflowId) setSelectedWorkflowId('');
    }
    setSaving(false);
  };

  // ── Step CRUD (update workflow steps inline) ──
  const handleUpdateStep = async (workflowId: string, stepIndex: number, field: 'actorRole' | 'actionType', value: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    const updatedSteps = workflow.steps.map((s, i) =>
      i === stepIndex ? { ...s, [field]: value } : s
    );

    setSaving(true);
    const { data, error } = await api.updateWorkflowDefinition(workflowId, {
      steps: updatedSteps.map(s => ({
        actorRole:  s.actorRole,
        actionType: s.actionType,
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

    const newStep = { actorRole: 'manager', actionType: 'REVIEW' as const, description: undefined };
    const updatedSteps = [...workflow.steps.map(s => ({
      actorRole:   s.actorRole,
      actionType:  s.actionType,
      description: s.description ?? undefined,
    })), newStep];

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
  const handleAssignWorkflow = async () => {
    if (!selectedDeptRoleId || !selectedWorkflowId) return;
    setSaving(true);
    const { data, error } = await api.createRoleWorkflowAssignment({
      departmentRoleId: selectedDeptRoleId,
      workflowId:       selectedWorkflowId,
    });
    if (!error && data) {
      setAssignments(prev => [...prev, data as RoleWorkflowAssignment]);
    }
    setSaving(false);
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('Remove this workflow assignment?')) return;
    setSaving(true);
    const { error } = await api.deleteRoleWorkflowAssignment(assignmentId);
    if (!error) {
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    }
    setSaving(false);
  };

  const handleAssignRubric = async (assignmentId: string, rubricId: string | null) => {
    setSaving(true);
    const { data, error } = await api.updateRoleWorkflowAssignment(assignmentId, {
      rubricId: rubricId === 'none' ? null : rubricId,
    });
    if (!error && data) {
      setAssignments(prev => prev.map(a => a.id === assignmentId ? data as RoleWorkflowAssignment : a));
    }
    setSaving(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Panel 1: Department Role Selector ── */}
      <Card className="glass-panel border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5 text-purple-500" />
            Workflow Configuration
          </CardTitle>
          <CardDescription>
            Assign workflow definitions to department roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Select existing dept role */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Department Role</label>
              <Select value={selectedDeptRoleId} onValueChange={setSelectedDeptRoleId}>
                <SelectTrigger className="glass-panel">
                  <SelectValue placeholder="Select a department role" />
                </SelectTrigger>
                <SelectContent className="glass-panel-strong">
                  {departmentRoles.map(dr => (
                    <SelectItem key={dr.id} value={dr.id}>
                      {dr.name ?? `${dr.department_name ?? 'Global'} - ${dr.role}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Create new dept role */}
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
                  <SelectItem value="none|director">Global - Director</SelectItem>
                  <SelectItem value="none|admin">Global - Admin</SelectItem>
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
                          {dept.name} - <span className="capitalize">{role}</span>
                        </SelectItem>
                      ));
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Panel 2: Assignments for selected dept role ── */}
      {selectedDeptRoleId && (
        <Card className="glass-panel border-border/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Assignments for{' '}
                  <Badge variant="secondary" className="ml-1 capitalize">
                    {selectedDeptRole?.name ?? `${selectedDeptRole?.department_name ?? 'Global'} - ${selectedDeptRole?.role}`}
                  </Badge>
                </CardTitle>
                <CardDescription>Workflow definitions assigned to this role</CardDescription>
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
                    No workflow assigned to this role yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map(a => (
                      <div key={a.id} className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{a.workflow.name}</span>
                            <Badge variant="outline" className="text-xs">{a.workflow.type}</Badge>
                            {a.isActive && <Badge className="text-xs bg-green-100 text-green-700">Active</Badge>}
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => void handleUnassign(a.id)}
                            disabled={saving}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Rubric assignment */}
                        <div className="flex items-center gap-3">
                          <Layout className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Select
                            value={a.rubricId ?? 'none'}
                            onValueChange={(val) => void handleAssignRubric(a.id, val)}
                          >
                            <SelectTrigger className="h-8 text-sm bg-background border-border/50">
                              <SelectValue placeholder="Assign rubric..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No rubric assigned</SelectItem>
                              {rubrics.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Workflow steps preview */}
                        <div className="ml-6 space-y-1">
                          {a.workflow.steps.map((step, i) => {
                            const info = getActionTypeInfo(step.actionType);
                            return (
                              <div key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono w-5 text-center">{i + 1}</span>
                                <info.icon className={`h-3 w-3 ${info.color}`} />
                                <span className="capitalize font-medium">{step.actorRole}</span>
                                <span>→</span>
                                <span>{info.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assign workflow to this role */}
                <div className="pt-2 border-t border-border/30">
                  <p className="text-sm font-medium mb-2">Assign a Workflow</p>
                  <div className="flex gap-2">
                    <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="Select workflow..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workflows.map(w => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} <span className="text-muted-foreground text-xs ml-1">({w.type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => void handleAssignWorkflow()}
                      disabled={!selectedWorkflowId || saving}
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

      {/* ── Panel 3: Workflow Definitions Manager ── */}
      <Card className="glass-panel border-border/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                Workflow Definitions
              </CardTitle>
              <CardDescription>Create and edit reusable workflow templates</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowNewWorkflow(true)}
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
                  placeholder="Workflow name..."
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
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowNewWorkflow(false); setNewWorkflowName(''); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void handleCreateWorkflow()} disabled={!newWorkflowName.trim() || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {/* List of workflow definitions */}
          {workflows.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm">
              No workflow definitions yet. Create one above.
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map(workflow => (
                <div key={workflow.id} className="rounded-lg border border-border/50 overflow-hidden">
                  {/* Workflow header */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                      selectedWorkflow?.id === workflow.id ? 'bg-primary/10 border-b border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedWorkflowId(prev => prev === workflow.id ? '' : workflow.id)}
                  >
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-4 w-4 text-primary" />
                      <div>
                        <span className="font-semibold text-sm">{workflow.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{workflow.type}</Badge>
                      </div>
                      <Badge variant="secondary" className="text-xs">{workflow.steps.length} steps</Badge>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteWorkflow(workflow.id); }}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Steps editor — only show for selected workflow */}
                  {selectedWorkflow?.id === workflow.id && (
                    <div className="p-4 space-y-3 bg-background">
                      {/* Self assessment always first */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs">0</div>
                        <div className="flex-1">
                          <span className="font-medium text-sm">Self Assessment</span>
                          <p className="text-xs text-muted-foreground">Employee completes self-assessment (automatic)</p>
                        </div>
                      </div>

                      {workflow.steps.map((step, idx) => {
                        const info = getActionTypeInfo(step.actionType);
                        return (
                          <div key={step.id}>
                            <div className="flex justify-center py-1">
                              <ArrowDown className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted font-bold text-xs">{idx + 1}</div>
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                {/* Actor Role */}
                                <Select
                                  value={step.actorRole}
                                  onValueChange={val => void handleUpdateStep(workflow.id, idx, 'actorRole', val)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ACTOR_ROLES.map(r => (
                                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {/* Action Type */}
                                <Select
                                  value={step.actionType}
                                  onValueChange={val => void handleUpdateStep(workflow.id, idx, 'actionType', val)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ACTION_TYPES.map(at => (
                                      <SelectItem key={at.value} value={at.value}>
                                        <div className="flex items-center gap-2">
                                          <at.icon className={`h-3.5 w-3.5 ${at.color}`} />
                                          {at.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-1">
                                <info.icon className={`h-4 w-4 ${info.color}`} />
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => void handleRemoveStep(workflow.id, idx)}
                                  disabled={saving}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex justify-center pt-2">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <Button
                        variant="outline" size="sm"
                        className="w-full border-dashed"
                        onClick={() => void handleAddStep(workflow.id)}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Add Step
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
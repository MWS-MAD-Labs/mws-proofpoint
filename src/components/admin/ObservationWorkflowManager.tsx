// src/components/admin/ObservationWorkflowManager.tsx
// Milestone 2: Admin UI to manage Classroom Observation workflows
//
// Features:
//   - Create / edit / delete WorkflowDefinition (type = CLASSROOM_OBSERVATION)
//   - Assign workflow to a DepartmentRole (RoleWorkflowAssignment)
//   - Link an observation rubric to the assignment
//   - Configure steps: manager fills → staff acknowledges
//   - A role can have MULTIPLE observation workflows
//   - Self Assessment is NOT assumed as step 1

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Eye, Plus, Trash2, Loader2, ArrowDown, Save,
  BookOpen, Users, CheckCircle2, FileText, Pencil, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowStep {
  id?: string;
  stepOrder: number;
  actorRole: string;
  actionType: string;
  description: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  type: string;
  description: string | null;
  steps: WorkflowStep[];
  assignments: Assignment[];
}

interface Assignment {
  id: string;
  departmentRoleId: string;
  workflowId: string;
  rubricId: string | null;
  isActive: boolean;
  departmentRole?: {
    id: string;
    role: string;
    department?: { id: string; name: string } | null;
  };
  rubric?: { id: string; name: string; templateType: string } | null;
}

interface DepartmentRole {
  id: string;
  role: string;
  department_id: string | null;
  department_name: string | null;
  name?: string | null;
}

interface RubricTemplate {
  id: string;
  name: string;
  template_type?: string;
  templateType?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: 'FILL_FORM',   label: 'Fill Form',   icon: FileText,    color: 'text-blue-500'   },
  { value: 'REVIEW',      label: 'Review',      icon: Eye,         color: 'text-purple-500' },
  { value: 'APPROVE',     label: 'Approve',     icon: CheckCircle2,color: 'text-green-500'  },
  { value: 'ACKNOWLEDGE', label: 'Acknowledge', icon: CheckCircle2,color: 'text-amber-500'  },
] as const;

const ACTOR_ROLES = [
  { value: 'staff',    label: 'Staff'    },
  { value: 'manager',  label: 'Manager'  },
  { value: 'director', label: 'Director' },
  { value: 'admin',    label: 'Admin'    },
] as const;

const DEFAULT_STEPS: WorkflowStep[] = [
  { stepOrder: 1, actorRole: 'manager', actionType: 'FILL_FORM',   description: 'Manager fills in the observation form' },
  { stepOrder: 2, actorRole: 'staff',   actionType: 'ACKNOWLEDGE', description: 'Staff acknowledges the observation result' },
];

// ─── Sub-component: Step Editor ───────────────────────────────────────────────

function StepRow({
  step,
  index,
  total,
  onChange,
  onDelete,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  onChange: (updated: WorkflowStep) => void;
  onDelete: () => void;
}) {
  const actionInfo = ACTION_TYPES.find(a => a.value === step.actionType) ?? ACTION_TYPES[0];
  const Icon = actionInfo.icon;

  return (
    <div className="border border-border/50 rounded-xl p-4 bg-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {index + 1}
        </div>
        <Icon className={`w-4 h-4 ${actionInfo.color}`} />
        <span className="text-sm font-medium flex-1">Step {index + 1}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        {/* Actor Role */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Actor</label>
          <Select
            value={step.actorRole}
            onValueChange={(val) => onChange({ ...step, actorRole: val })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTOR_ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Type */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Action</label>
          <Select
            value={step.actionType}
            onValueChange={(val) => onChange({ ...step, actionType: val })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => (
                <SelectItem key={a.value} value={a.value}>
                  <div className="flex items-center gap-2">
                    <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                    {a.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block font-medium">Description (optional)</label>
        <Input
          value={step.description}
          onChange={(e) => onChange({ ...step, description: e.target.value })}
          placeholder="Describe what this step does..."
          className="h-8 text-sm"
        />
      </div>

      {index < total - 1 && (
        <div className="flex justify-center mt-3">
          <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Workflow Form (Create / Edit) ─────────────────────────────

function WorkflowForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: WorkflowDefinition;
  onSave: (name: string, description: string, steps: WorkflowStep[]) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name,        setName]        = useState(initial?.name        ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [steps,       setSteps]       = useState<WorkflowStep[]>(
    initial?.steps ?? DEFAULT_STEPS
  );

  const addStep = () => {
    setSteps(prev => [
      ...prev,
      {
        stepOrder:   prev.length + 1,
        actorRole:   'manager',
        actionType:  'FILL_FORM',
        description: '',
      },
    ]);
  };

  const updateStep = (index: number, updated: WorkflowStep) => {
    setSteps(prev => prev.map((s, i) => i === index ? updated : s));
  };

  const deleteStep = (index: number) => {
    setSteps(prev =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 }))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const normalizedSteps = steps.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    await onSave(name.trim(), description.trim(), normalizedSteps);
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Workflow Name <span className="text-destructive">*</span></label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Classroom Observation — Elementary"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of this workflow..."
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Workflow Steps</label>
          <Button variant="outline" size="sm" onClick={addStep} className="gap-1.5 h-7 text-xs">
            <Plus className="w-3 h-3" /> Add Step
          </Button>
        </div>

        {steps.length === 0 ? (
          <div className="border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
            No steps yet — click &quot;Add Step&quot; to begin
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, i) => (
              <StepRow
                key={i}
                step={step}
                index={i}
                total={steps.length}
                onChange={(updated) => updateStep(i, updated)}
                onDelete={() => deleteStep(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || steps.length === 0}
          className="gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {initial ? 'Save Changes' : 'Create Workflow'}
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-component: Assignment Panel ─────────────────────────────────────────

function AssignmentPanel({
  workflow,
  departmentRoles,
  rubrics,
  onAssign,
  onRemoveAssignment,
  onUpdateRubric,
  saving,
}: {
  workflow: WorkflowDefinition;
  departmentRoles: DepartmentRole[];
  rubrics: RubricTemplate[];
  onAssign: (workflowId: string, departmentRoleId: string) => Promise<void>;
  onRemoveAssignment: (assignmentId: string) => Promise<void>;
  onUpdateRubric: (assignmentId: string, rubricId: string | null) => Promise<void>;
  saving: boolean;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Roles not yet assigned to this workflow
  const assignedRoleIds = new Set(workflow.assignments.map(a => a.departmentRoleId));
  const availableRoles = departmentRoles.filter(r => !assignedRoleIds.has(r.id));

  return (
    <div className="space-y-4">
      {/* Existing assignments */}
      {workflow.assignments.length > 0 ? (
        <div className="space-y-2">
          {workflow.assignments.map((assignment) => {
            const roleName = assignment.departmentRole
              ? `${assignment.departmentRole.department?.name ?? 'Global'} — ${assignment.departmentRole.role}`
              : '—';

            return (
              <div key={assignment.id} className="border border-border/50 rounded-xl p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{roleName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveAssignment(assignment.id)}
                    disabled={saving}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                {/* Rubric selector */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Linked Observation Rubric</label>
                  <Select
                    value={assignment.rubricId ?? 'none'}
                    onValueChange={(val) =>
                      onUpdateRubric(assignment.id, val === 'none' ? null : val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select rubric..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No rubric linked</SelectItem>
                      {rubrics
                        .filter((r) => {
                          const type = r.template_type ?? r.templateType;
                          return !type || type === 'CLASSROOM_OBSERVATION' || type === 'GENERIC';
                        })
                        .map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No department roles assigned yet.
        </p>
      )}

      {/* Add new assignment */}
      {availableRoles.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger className="flex-1 h-8 text-sm">
              <SelectValue placeholder="Assign to a department role..." />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name || `${r.department_name ?? 'Global'} — ${r.role}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs flex-shrink-0"
            disabled={!selectedRoleId || saving}
            onClick={async () => {
              await onAssign(workflow.id, selectedRoleId);
              setSelectedRoleId('');
            }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ObservationWorkflowManager() {
  const [workflows,      setWorkflows]      = useState<WorkflowDefinition[]>([]);
  const [departmentRoles,setDepartmentRoles]= useState<DepartmentRole[]>([]);
  const [rubrics,        setRubrics]        = useState<RubricTemplate[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [alert,          setAlert]          = useState<{ type: 'error'|'success'; message: string } | null>(null);

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<WorkflowDefinition | null>(null);

  const showAlert = (type: 'error'|'success', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, drRes, rbRes] = await Promise.all([
        fetch('/api/admin/workflow-definitions'),
        fetch('/api/admin/department-roles'),
        fetch('/api/rubrics?templateType=CLASSROOM_OBSERVATION,GENERIC'),
      ]);

      const wfJson = await wfRes.json();
      const drJson = await drRes.json();
      const rbJson = await rbRes.json();

      // Only show CLASSROOM_OBSERVATION workflows
      const allWorkflows: WorkflowDefinition[] = Array.isArray(wfJson) ? wfJson : [];
      setWorkflows(allWorkflows.filter(w => w.type === 'CLASSROOM_OBSERVATION'));

      setDepartmentRoles(Array.isArray(drJson?.data) ? drJson.data : Array.isArray(drJson) ? drJson : []);

      // CLASSROOM_OBSERVATION + GENERIC rubrics combined for selector
      const allRubrics = Array.isArray(rbJson) ? rbJson : Array.isArray(rbJson?.data) ? rbJson.data : [];
      setRubrics(allRubrics);
    } catch (err) {
      console.error('fetchAll error:', err);
      showAlert('error', 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Workflow CRUD ───────────────────────────────────────────────────────────

  const handleCreate = async (name: string, description: string, steps: WorkflowStep[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/workflow-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'CLASSROOM_OBSERVATION', description, steps }),
      });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to create workflow.'); return; }
      showAlert('success', `Workflow "${name}" created successfully.`);
      setShowCreateForm(false);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, name: string, description: string, steps: WorkflowStep[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/workflow-definitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, description, steps }),
      });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to update workflow.'); return; }
      showAlert('success', 'Workflow updated successfully.');
      setEditingId(null);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workflow: WorkflowDefinition) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/workflow-definitions?id=${workflow.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to delete workflow.'); return; }
      showAlert('success', `Workflow "${workflow.name}" deleted.`);
      setDeleteTarget(null);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  // ── Assignment CRUD ─────────────────────────────────────────────────────────

  const handleAssign = async (workflowId: string, departmentRoleId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/role-workflow-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, departmentRoleId }),
      });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to assign workflow.'); return; }
      showAlert('success', 'Workflow assigned to department role.');
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/role-workflow-assignments?id=${assignmentId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to remove assignment.'); return; }
      showAlert('success', 'Assignment removed.');
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRubric = async (assignmentId: string, rubricId: string | null) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/role-workflow-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assignmentId, rubricId }),
      });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to update rubric.'); return; }
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Alert */}
      {alert && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${
          alert.type === 'error'
            ? 'bg-destructive/10 text-destructive border-destructive/20'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {alert.message}
        </div>
      )}

      {/* Header */}
      <Card className="border-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-blue-500" />
                Observation Workflow Manager
              </CardTitle>
              <CardDescription>
                Create and manage Classroom Observation workflows. A department role can have multiple observation workflows.
              </CardDescription>
            </div>
            {!showCreateForm && (
              <Button onClick={() => setShowCreateForm(true)} className="gap-2" size="sm">
                <Plus className="w-4 h-4" />
                New Workflow
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Create Form */}
        {showCreateForm && (
          <CardContent className="border-t border-border/30 pt-4">
            <p className="text-sm font-semibold mb-4">New Classroom Observation Workflow</p>
            <WorkflowForm
              onSave={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              saving={saving}
            />
          </CardContent>
        )}
      </Card>

      {/* Workflow List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No observation workflows yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click &quot;New Workflow&quot; to create one
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => {
            const isExpanded = expandedId === workflow.id;
            const isEditing  = editingId  === workflow.id;

            return (
              <Card key={workflow.id} className="border-border/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{workflow.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">Classroom Observation</Badge>
                        <Badge variant="outline" className="text-xs">
                          {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {workflow.assignments.length} role{workflow.assignments.length !== 1 ? 's' : ''} assigned
                        </Badge>
                      </div>
                      {workflow.description && (
                        <p className="text-xs text-muted-foreground mt-1">{workflow.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setExpandedId(isExpanded ? null : workflow.id)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditingId(isEditing ? null : workflow.id); setExpandedId(null); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(workflow)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Edit Form */}
                {isEditing && (
                  <CardContent className="border-t border-border/30 pt-4">
                    <WorkflowForm
                      initial={workflow}
                      onSave={(name, desc, steps) => handleUpdate(workflow.id, name, desc, steps)}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  </CardContent>
                )}

                {/* Expanded Detail: Steps + Assignments */}
                {isExpanded && !isEditing && (
                  <CardContent className="border-t border-border/30 pt-4 space-y-5">

                    {/* Steps (read-only view) */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Steps
                      </p>
                      <div className="space-y-2">
                        {workflow.steps.map((step, i) => {
                          const actionInfo = ACTION_TYPES.find(a => a.value === step.actionType);
                          const Icon = actionInfo?.icon ?? FileText;
                          return (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/20">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {step.stepOrder}
                              </div>
                              <Icon className={`w-3.5 h-3.5 ${actionInfo?.color ?? 'text-muted-foreground'}`} />
                              <span className="text-sm flex-1">{step.description || `${step.actorRole} — ${step.actionType}`}</span>
                              <Badge variant="outline" className="text-xs capitalize">{step.actorRole}</Badge>
                              <Badge variant="outline" className="text-xs">{actionInfo?.label ?? step.actionType}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assignments */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Department Role Assignments
                      </p>
                      <AssignmentPanel
                        workflow={workflow}
                        departmentRoles={departmentRoles}
                        rubrics={rubrics}
                        onAssign={handleAssign}
                        onRemoveAssignment={handleRemoveAssignment}
                        onUpdateRubric={handleUpdateRubric}
                        saving={saving}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              {deleteTarget && deleteTarget.assignments.length > 0 && (
                <span className="block mt-1 text-destructive">
                  This workflow is currently assigned to {deleteTarget.assignments.length} department role(s). Remove those assignments first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={saving || (deleteTarget?.assignments.length ?? 0) > 0}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

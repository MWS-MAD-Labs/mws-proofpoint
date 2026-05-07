'use client';

import { useState, useEffect } from 'react';
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
    ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface Department {
    id: string;
    name: string;
    hierarchy_level?: 'root' | 'department' | 'subdepartment';
}

interface DepartmentRole {
    id: string;
    department_id: string;
    role: string;
    department_name: string;
    default_template_id?: string;
    name?: string;
}

interface RubricTemplate {
    id: string;
    name: string;
}

interface WorkflowStep {
    id: string;
    department_role_id: string;
    step_order: number;
    approver_role: string;
    step_type: string;
}

interface WorkflowEditorProps {
    departments: Department[];
}

const STEP_TYPES = [
    { value: 'review', label: 'Review', icon: FileSearch, color: 'text-blue-500' },
    { value: 'approval', label: 'Approval', icon: CheckCircle2, color: 'text-green-500' },
    { value: 'review_and_approval', label: 'Review + Approval', icon: CheckCheck, color: 'text-purple-500' },
    { value: 'admin_review', label: 'Admin Review', icon: ShieldCheck, color: 'text-orange-500' },
    { value: 'acknowledge', label: 'Acknowledge', icon: User, color: 'text-amber-500' },
] as const;

const ROLES = ['staff', 'supervisor', 'manager', 'director'] as const;

export function WorkflowEditor({ departments }: WorkflowEditorProps) {
    const [departmentRoles, setDepartmentRoles] = useState<DepartmentRole[]>([]);
    const [selectedDeptRoleId, setSelectedDeptRoleId] = useState('');
    const [workflows, setWorkflows] = useState<WorkflowStep[]>([]);
    const [rubrics, setRubrics] = useState<RubricTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Fetch department roles and rubrics
    useEffect(() => {
        const fetchData = async () => {
            const [drRes, rRes] = await Promise.all([
                api.getDepartmentRoles(),
                api.getRubrics()
            ]);
            if (drRes.data) setDepartmentRoles(drRes.data as DepartmentRole[]);
            if (rRes.data) setRubrics(rRes.data as RubricTemplate[]);
        };
        fetchData();
    }, []);

    // Fetch workflows when department role changes
    useEffect(() => {
        if (selectedDeptRoleId) {
            fetchWorkflows(selectedDeptRoleId);
        } else {
            setWorkflows([]);
        }
    }, [selectedDeptRoleId]);

    const ensureMandatorySteps = async (currentWorkflows: WorkflowStep[], deptRoleId: string) => {
        const hasAdminReview = currentWorkflows.some(w => w.step_type === 'admin_review');
        const hasAcknowledge = currentWorkflows.some(w => w.step_type === 'acknowledge');

        // Identify the correct acknowledge role based on the department role
        // For "Mad Labs - Manager", the role is "manager", so the acknowledger should be "manager"
        // For "Global - Director", role is "director", acknowledger "director"
        // We can get this from departmentRoles list
        const deptRole = departmentRoles.find(dr => dr.id === deptRoleId);
        // Default to staff if we can't determine (safe fallback), but logic should hold
        // The role string in departmentRoles is exactly what we need (e.g., 'manager', 'director', 'staff')
        const acknowledgeRole = deptRole?.role || 'staff';

        if (!hasAdminReview) {
            await api.createApprovalWorkflow({
                department_role_id: deptRoleId,
                step_order: 100, // Large number to force to end
                approver_role: 'admin',
                step_type: 'admin_review',
            });
        }

        if (!hasAcknowledge) {
            await api.createApprovalWorkflow({
                department_role_id: deptRoleId,
                step_order: 200, // Even larger number
                approver_role: acknowledgeRole,
                step_type: 'acknowledge',
            });
        }

        // If we created anything, we'll re-fetch in the main loop or just let the next fetch handle it effectively?
        // Actually, better to just let the caller re-fetch or we assume the next fetchWorkflows call will pick them up
        // But since this is called INSIDE fetchWorkflows, we should be careful.
        // Let's modify the flow: ensure steps exist -> then set state.
    };

    const fetchWorkflows = async (deptRoleId: string) => {
        setLoading(true);
        let { data } = await api.getApprovalWorkflows(deptRoleId);

        if (data) {
            // Check for mandatory steps and create if missing
            const currentWorkflows = data as WorkflowStep[];
            const hasAdminReview = currentWorkflows.some(w => w.step_type === 'admin_review');
            const hasAcknowledge = currentWorkflows.some(w => w.step_type === 'acknowledge');

            if (!hasAdminReview || !hasAcknowledge) {
                await ensureMandatorySteps(currentWorkflows, deptRoleId);
                // Re-fetch to get the new IDs
                const res = await api.getApprovalWorkflows(deptRoleId);
                data = res.data;
            }

            if (data) {
                setWorkflows((data as WorkflowStep[]).sort((a, b) => a.step_order - b.step_order));
            }
        }
        setLoading(false);
    };

    const handleAddStep = async () => {
        if (!selectedDeptRoleId) return;

        setSaving(true);
        // Only consider user-defined steps for the order calculation (steps < 100)
        const userSteps = workflows.filter(w => w.step_order < 100);
        const nextOrder = userSteps.length > 0
            ? Math.max(...userSteps.map(w => w.step_order)) + 1
            : 1;

        const { data, error } = await api.createApprovalWorkflow({
            department_role_id: selectedDeptRoleId,
            step_order: nextOrder,
            approver_role: 'director', // Default
            step_type: 'review',
        });

        if (!error && data) {
            // Refetch to ensure correct ordering with mandatory steps
            fetchWorkflows(selectedDeptRoleId);
        }
        setSaving(false);
    };

    const handleUpdateStep = async (stepId: string, updates: Partial<WorkflowStep>) => {
        setSaving(true);
        const { data, error } = await api.updateApprovalWorkflow(stepId, updates);
        if (!error && data) {
            setWorkflows(prev =>
                prev.map(w => w.id === stepId ? { ...w, ...data as WorkflowStep } : w)
            );
        }
        setSaving(false);
    };

    const handleDeleteStep = async (stepId: string) => {
        setSaving(true);
        const { error } = await api.deleteApprovalWorkflow(stepId);
        if (!error) {
            setWorkflows(prev => prev.filter(w => w.id !== stepId));
        }
        setSaving(false);
    };

    const handleCreateDeptRole = async (departmentId: string, role: string) => {
        setSaving(true);
        const { data, error } = await api.createDepartmentRole({
            department_id: departmentId || (null as any), // Cast to null for global roles
            role: role,
        });
        if (!error && data) {
            const newRole = data as DepartmentRole;
            setDepartmentRoles(prev => [...prev, newRole]);
            setSelectedDeptRoleId(newRole.id);
        }
        setSaving(false);
    };

    const handleDeleteDeptRole = async () => {
        if (!selectedDeptRoleId || !confirm('Are you sure you want to delete this entire workflow configuration? This cannot be undone.')) return;

        setSaving(true);
        const { error } = await api.deleteDepartmentRole(selectedDeptRoleId);
        if (!error) {
            setDepartmentRoles(prev => prev.filter(dr => dr.id !== selectedDeptRoleId));
            setSelectedDeptRoleId('');
        }
        setSaving(false);
    };

    const handleUpdateName = async (name: string) => {
        if (!selectedDeptRoleId) return;
        setSaving(true);
        const { data, error } = await api.updateDepartmentRole(selectedDeptRoleId, { name });
        if (!error && data) {
            setDepartmentRoles(prev => prev.map(dr =>
                dr.id === selectedDeptRoleId ? { ...dr, name: (data as any).name } : dr
            ));
        }
        setSaving(false);
    };

    const getStepTypeInfo = (stepType: string) => {
        return STEP_TYPES.find(s => s.value === stepType) || STEP_TYPES[0];
    };

    const selectedDeptRole = departmentRoles.find(dr => dr.id === selectedDeptRoleId);

    return (
        <div className="space-y-6">
            {/* Selector */}
            <Card className="glass-panel border-border/30">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <GitBranch className="h-5 w-5 text-purple-500" />
                        Workflow Configuration
                    </CardTitle>
                    <CardDescription>
                        Configure approval workflows for specific department roles
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
                                            {dr.name || `${dr.department_name || 'Global'} - ${dr.role}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Quick add department role */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Or Create New</label>
                            <div className="flex gap-2">
                                <Select
                                    onValueChange={(value) => {
                                        const [deptId, role] = value.split('|');
                                        if (role) {
                                            handleCreateDeptRole(deptId === 'none' ? '' : deptId, role);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="glass-panel flex-1">
                                        <SelectValue placeholder="Add role..." />
                                    </SelectTrigger>
                                    <SelectContent className="glass-panel-strong">
                                        <SelectItem value="none|director">Global - Director</SelectItem>
                                        <SelectItem value="none|admin">Global - Admin</SelectItem>

                                        {departments.flatMap(dept => {
                                            const level = dept.hierarchy_level || 'root';
                                            const rolesForLevel = level === 'subdepartment'
                                                ? ['supervisor', 'staff']
                                                : ['manager', 'staff'];

                                            return rolesForLevel
                                                .filter(role =>
                                                    !departmentRoles.some(dr =>
                                                        dr.department_id === dept.id && dr.role === role
                                                    )
                                                )
                                                .map(role => (
                                                    <SelectItem
                                                        key={`${dept.id}|${role}`}
                                                        value={`${dept.id}|${role}`}
                                                    >
                                                        {dept.name} - <span className="capitalize">{role}</span>
                                                    </SelectItem>
                                                ));
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Workflow Steps */}
            {selectedDeptRoleId && (
                <Card className="glass-panel border-border/30">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">
                                    Approval Flow for{' '}
                                    <Badge variant="secondary" className="ml-1 capitalize">
                                        {selectedDeptRole?.name || `${selectedDeptRole?.department_name || 'Global'} - ${selectedDeptRole?.role}`}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Define the steps in the approval process
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeleteDeptRole}
                                    disabled={saving}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete Workflow
                                </Button>
                                <Button
                                    onClick={handleAddStep}
                                    disabled={saving}
                                    size="sm"
                                    className="glow-primary"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                    Add Step
                                </Button>
                            </div>
                        </div>

                        {/* Workflow Name & Rubric Assignment */}
                        <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <GitBranch className="h-4 w-4" />
                                        Workflow Name
                                    </label>
                                    <Input
                                        placeholder="e.g., Standard Engineering Review"
                                        defaultValue={selectedDeptRole?.name || ''}
                                        onBlur={(e) => handleUpdateName(e.target.value)}
                                        className="bg-background border-primary/20 focus-visible:ring-primary/30"
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">Provide a custom name to identify this configuration.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Layout className="h-4 w-4" />
                                        Assigned Rubric
                                    </label>
                                    <Select
                                        value={selectedDeptRole?.default_template_id || 'none'}
                                        onValueChange={async (value) => {
                                            if (!selectedDeptRoleId) return;
                                            setSaving(true);
                                            const { data, error } = await api.updateDepartmentRole(selectedDeptRoleId, {
                                                default_template_id: value === 'none' ? undefined : value
                                            });
                                            if (!error && data) {
                                                setDepartmentRoles(prev => prev.map(dr =>
                                                    dr.id === selectedDeptRoleId ? { ...dr, default_template_id: (data as any).default_template_id } : dr
                                                ));
                                            }
                                            setSaving(false);
                                        }}
                                    >
                                        <SelectTrigger className="bg-background border-primary/20 focus-visible:ring-primary/30">
                                            <SelectValue placeholder="Assign a rubric template" />
                                        </SelectTrigger>
                                        <SelectContent className="glass-panel-strong">
                                            <SelectItem value="none">No assignment</SelectItem>
                                            {rubrics.map(r => (
                                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground italic">The rubric automatically shown to users with this role.</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : workflows.length === 0 ? (
                            <div className="text-center py-8 border border-dashed rounded-lg">
                                <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-muted-foreground">No workflow steps defined</p>
                                <p className="text-xs text-muted-foreground">Add steps to create an approval flow</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Self Assessment (always first, read-only) */}
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                                        0
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-medium">Self Assessment</span>
                                        <p className="text-xs text-muted-foreground">Employee completes self-assessment</p>
                                    </div>
                                    <Badge variant="outline" className="capitalize">
                                        {selectedDeptRole?.role}
                                    </Badge>
                                </div>

                                {workflows.filter(w => w.step_order < 100).map((step, index) => {
                                    return (
                                        <div key={step.id}>
                                            <div className="flex justify-center py-1">
                                                <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <Select
                                                        value={step.step_type}
                                                        onValueChange={value => handleUpdateStep(step.id, { step_type: value })}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {STEP_TYPES.filter(st => !['admin_review', 'acknowledge'].includes(st.value)).map(st => (
                                                                <SelectItem key={st.value} value={st.value}>
                                                                    <div className="flex items-center gap-2">
                                                                        <st.icon className={`h-4 w-4 ${st.color}`} />
                                                                        {st.label}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Select
                                                        value={step.approver_role}
                                                        onValueChange={value => handleUpdateStep(step.id, { approver_role: value })}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="manager">Manager</SelectItem>
                                                            <SelectItem value="supervisor">Supervisor</SelectItem>
                                                            <SelectItem value="director">Director</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteStep(step.id)}
                                                    disabled={saving}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Mandatory Steps */}
                                {workflows.filter(w => w.step_order >= 100).map((step) => {
                                    // Determine visual index (1-based after user steps)
                                    const userStepCount = workflows.filter(w => w.step_order < 100).length;
                                    // admin_review is typically 100 -> index + 1
                                    // acknowledge is 200 -> index + 2
                                    // But let's just use the relative order in the full list + 1
                                    const stepIndex = workflows.indexOf(step) + 1;

                                    const stepInfo = getStepTypeInfo(step.step_type);

                                    return (
                                        <div key={step.id}>
                                            <div className="flex justify-center py-1">
                                                <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 font-bold text-sm">
                                                    {stepIndex}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 font-medium">
                                                        <stepInfo.icon className={`h-4 w-4 ${stepInfo.color}`} />
                                                        {stepInfo.label}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {step.step_type === 'admin_review'
                                                            ? 'Admin reviews completion and correctness'
                                                            : 'Employee acknowledges final score'}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="capitalize">
                                                    {step.approver_role}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Workflow Templates */}
                        {workflows.length === 0 && (
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <p className="text-sm font-medium mb-2">Quick Templates:</p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            // Staff flow template
                                            await api.createApprovalWorkflow({
                                                department_role_id: selectedDeptRoleId,
                                                step_order: 1,
                                                approver_role: 'manager',
                                                step_type: 'review',
                                            });
                                            await api.createApprovalWorkflow({
                                                department_role_id: selectedDeptRoleId,
                                                step_order: 2,
                                                approver_role: 'director',
                                                step_type: 'approval',
                                            });
                                            await api.createApprovalWorkflow({
                                                department_role_id: selectedDeptRoleId,
                                                step_order: 3,
                                                approver_role: 'staff',
                                                step_type: 'acknowledge',
                                            });
                                            fetchWorkflows(selectedDeptRoleId);
                                        }}
                                    >
                                        Staff Flow
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            // Manager flow template
                                            await api.createApprovalWorkflow({
                                                department_role_id: selectedDeptRoleId,
                                                step_order: 1,
                                                approver_role: 'director',
                                                step_type: 'review_and_approval',
                                            });
                                            await api.createApprovalWorkflow({
                                                department_role_id: selectedDeptRoleId,
                                                step_order: 2,
                                                approver_role: 'manager',
                                                step_type: 'acknowledge',
                                            });
                                            fetchWorkflows(selectedDeptRoleId);
                                        }}
                                    >
                                        Manager Flow
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

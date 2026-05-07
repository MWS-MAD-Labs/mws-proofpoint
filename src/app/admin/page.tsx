'use client';

import { useState, useEffect, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Shield,
    Users,
    Search,
    Loader2,
    UserPlus,
    MoreHorizontal,
    Mail,
    Building,
    UserCheck,
    ShieldAlert,
    Settings2,
    GitBranch,
    Pencil,
    Trash2,
    AlertTriangle,
    ChevronRight,
    FolderTree,
    Plus,
    Clock,
    ChevronDown,
    FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserManagementModal } from '@/components/admin/UserManagementModal';
import { DepartmentModal } from '@/components/admin/DepartmentModal';
import { WorkflowEditor } from '@/components/admin/WorkflowEditor';
import { AdminAssessmentReview } from '@/components/admin/AdminAssessmentReview';

interface User {
    id: string;
    email: string;
    full_name: string | null;
    niy: string | null;
    job_title: string | null;
    department_id: string | null;
    department_name: string | null;
    roles: string[];
    status: string;
}

interface RoleHolder {
    user_id: string;
    full_name: string;
    email: string;
    role: string;
}

interface Department {
    id: string;
    name: string;
    parent_id: string | null;
    parent_name: string | null;
    user_count: string;
    hierarchy_level: 'root' | 'department' | 'subdepartment';
    role_holders: RoleHolder[];
}

function AdminContent() {
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('users');

    // Modal states
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deptModalOpen, setDeptModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);

    // Delete confirmation
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'user' | 'department'; item: User | Department; permanent?: boolean } | null>(null);
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

    const toggleDept = (id: string) => {
        setExpandedDepts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getDeptColor = (name: string) => {
        const colors = [
            'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300',
            'border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300',
            'border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:border-zinc-300',
            'border-sky-200 bg-sky-50/50 text-sky-700 hover:border-sky-300',
            'border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:border-indigo-300',
            'border-amber-200 bg-amber-50/50 text-amber-700 hover:border-amber-300',
            'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:border-emerald-300',
        ];
        // Simple hash to pick a consistent color
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const fetchData = async () => {
        setLoading(true);
        const [usersRes, deptsRes] = await Promise.all([
            api.getAdminUsers(),
            api.getDepartments(),
        ]);

        if (!usersRes.error && usersRes.data) {
            setUsers((usersRes.data as User[]).map(user => ({
                ...user,
                roles: user.roles || ['staff'],
                department_name: user.department_name || 'Unassigned'
            })));
        }

        if (!deptsRes.error && deptsRes.data) {
            setDepartments(deptsRes.data as Department[]);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredDepts = departments.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;

        let result;
        if (itemToDelete.type === 'user') {
            result = await api.deleteUser((itemToDelete.item as User).id, itemToDelete.permanent);
        } else {
            result = await api.deleteDepartment((itemToDelete.item as Department).id);
        }

        if (result.error) {
            toast({
                title: "Error",
                description: String(result.error),
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: `${itemToDelete.type === 'user' ? (itemToDelete.permanent ? 'User permanently deleted' : 'User suspended') : 'Department deleted'} successfully.`,
            });
            fetchData();
        }

        setDeleteConfirmOpen(false);
        setItemToDelete(null);
    };

    const getRoleBadge = (roles: any) => {
        let safeRoles: string[] = [];

        if (Array.isArray(roles)) {
            safeRoles = roles.filter(r => typeof r === 'string');
        } else if (typeof roles === 'string' && roles.length > 0) {
            // Handle cases where roles might be returned as a string (e.g., CSV)
            safeRoles = roles.replace(/[{}]/g, '').split(',').map(r => r.trim()).filter(Boolean);
        }

        if (safeRoles.length === 0) {
            safeRoles = ['staff'];
        }

        return (
            <div className="flex flex-wrap gap-1">
                {safeRoles.map((role: string) => (
                    <Badge
                        key={role}
                        variant={role === 'admin' ? 'default' : 'secondary'}
                        className={
                            role === 'admin' ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100' :
                                role === 'director' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                    role === 'manager' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50'
                        }
                    >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                ))}
            </div>
        );
    };

    // Get available roles based on hierarchy level
    const getAvailableRoles = (level: string): string[] => {
        switch (level) {
            case 'root': return ['manager', 'staff'];
            case 'department': return ['manager', 'staff'];
            case 'subdepartment': return ['supervisor', 'staff'];
            default: return ['staff'];
        }
    };

    const getRoleBadgeStyle = (role: string) => {
        switch (role) {
            case 'director': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'manager': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'supervisor': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'staff': return 'bg-blue-50 text-blue-600 border-blue-100';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    // Build department tree structure
    const getDeptTree = () => {
        const rootDepts = departments.filter(d => !d.parent_id);
        const getChildren = (parentId: string): Department[] =>
            departments.filter(d => d.parent_id === parentId);

        const renderDept = (dept: Department, level: number = 0): JSX.Element => {
            const isExpanded = expandedDepts.has(dept.id);
            const children = getChildren(dept.id);
            const hasChildren = children.length > 0;
            const availableRoles = getAvailableRoles(dept.hierarchy_level);
            const deptStyle = getDeptColor(dept.name);

            const roleHoldersByRole: Record<string, RoleHolder[]> = {};
            for (const holder of dept.role_holders) {
                if (!roleHoldersByRole[holder.role]) roleHoldersByRole[holder.role] = [];
                roleHoldersByRole[holder.role].push(holder);
            }

            // Stats breakdown
            const mgrCount = (roleHoldersByRole['manager'] || []).length;
            const supCount = (roleHoldersByRole['supervisor'] || []).length;
            const staffCount = (roleHoldersByRole['staff'] || []).length;

            return (
                <div key={dept.id} className={`${level > 0 ? 'border-l-2 border-muted/50 ml-6' : ''}`}>
                    <div
                        className={cn(
                            "flex items-start gap-3 p-4 rounded-xl border-2 transition-all group mb-2 mx-2",
                            deptStyle,
                            isExpanded && "shadow-sm border-opacity-100"
                        )}
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {hasChildren && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 p-0 hover:bg-black/5"
                                        onClick={() => toggleDept(dept.id)}
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </Button>
                                )}
                                <Building className="h-4 w-4 opacity-70" />
                                <span className="font-bold text-base">{dept.name}</span>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold bg-white/50">
                                    {dept.hierarchy_level}
                                </Badge>

                                <div className="flex gap-1 ml-2">
                                    {mgrCount > 0 && <Badge variant="outline" className="text-[9px] bg-amber-100/50 text-amber-700 border-amber-200">M: {mgrCount}</Badge>}
                                    {supCount > 0 && <Badge variant="outline" className="text-[9px] bg-purple-100/50 text-purple-700 border-purple-200">S: {supCount}</Badge>}
                                    {staffCount > 0 && <Badge variant="outline" className="text-[9px] bg-blue-100/50 text-blue-700 border-blue-200">E: {staffCount}</Badge>}
                                </div>
                            </div>

                            {/* Role Holders Grid - Only show if expanded or root */}
                            {(isExpanded || level === 0) && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {availableRoles.map(role => {
                                        const holders = roleHoldersByRole[role] || [];
                                        return (
                                            <div key={role} className="p-3 rounded-lg bg-white/40 border border-black/5 hover:bg-white/60 transition-colors">
                                                <div className="flex items-center gap-1 mb-2">
                                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold ${getRoleBadgeStyle(role)}`}>
                                                        {role}
                                                    </Badge>
                                                </div>
                                                {holders.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {holders.map(h => (
                                                            <button
                                                                key={h.user_id}
                                                                onClick={() => {
                                                                    const fullUser = users.find(u => u.id === h.user_id);
                                                                    if (fullUser) {
                                                                        setEditingUser(fullUser);
                                                                        setUserModalOpen(true);
                                                                    }
                                                                }}
                                                                className="flex items-center gap-2 text-xs w-full hover:bg-black/5 p-1 rounded transition-colors text-left"
                                                            >
                                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                                                                    {h.full_name?.charAt(0) || '?'}
                                                                </div>
                                                                <span className="truncate flex-1 font-medium">{h.full_name || h.email}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground italic">No assignee</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0 pt-0.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-black/5"
                                onClick={() => {
                                    setEditingDept(dept);
                                    setDeptModalOpen(true);
                                }}
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/5"
                                onClick={() => {
                                    setItemToDelete({ type: 'department', item: dept });
                                    setDeleteConfirmOpen(true);
                                }}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    {isExpanded && children.map(child => renderDept(child, level + 1))}
                </div>
            );
        };

        return rootDepts.map(dept => renderDept(dept));
    };

    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 w-fit text-xs font-bold uppercase tracking-wider mb-2">
                        <Shield className="h-3 w-3" />
                        Control Center
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Administration</h1>
                    <p className="text-muted-foreground">Manage users, departments, and approval workflows.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            className="pl-10 glass-panel"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="glass-panel border-border/30 overflow-hidden relative group hover-glow transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="h-12 w-12" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Users</CardDescription>
                        <CardTitle className="text-3xl font-bold">{users.length}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="glass-panel border-border/30 overflow-hidden relative group hover-glow transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldAlert className="h-12 w-12" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription>Admins</CardDescription>
                        <CardTitle className="text-3xl font-bold">{users.filter(u => u.roles?.includes('admin')).length}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="glass-panel border-border/30 overflow-hidden relative group hover-glow transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Building className="h-12 w-12" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription>Departments</CardDescription>
                        <CardTitle className="text-3xl font-bold">{departments.length}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="glass-panel p-1">
                    <TabsTrigger value="users" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Users
                    </TabsTrigger>
                    <TabsTrigger value="departments" className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4" />
                        Departments
                    </TabsTrigger>
                    <TabsTrigger value="workflows" className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Workflows
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Reviews
                    </TabsTrigger>
                </TabsList>

                {/* Users Tab */}
                <TabsContent value="users">
                    <Card className="glass-panel border-border/30 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-rose-500/30 via-rose-500 to-rose-500/30" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings2 className="h-5 w-5 text-rose-500" />
                                        User Management
                                    </CardTitle>
                                    <CardDescription>Manage user accounts, roles, and department assignments</CardDescription>
                                </div>
                                <Button
                                    className="glow-primary"
                                    onClick={() => {
                                        setEditingUser(null);
                                        setUserModalOpen(true);
                                    }}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add User
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                                    <p className="text-muted-foreground font-medium">Loading users...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-20 border border-dashed rounded-xl bg-muted/20">
                                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                    <h3 className="text-lg font-semibold">No users found</h3>
                                    <p className="text-muted-foreground">No users match your search criteria.</p>
                                </div>
                            ) : (
                                <div className="rounded-md border border-border/50 overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-[250px]">User</TableHead>
                                                <TableHead>NIY</TableHead>
                                                <TableHead>Job Title</TableHead>
                                                <TableHead>Department</TableHead>
                                                <TableHead>Roles</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredUsers.map((user) => (
                                                <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                                {user.full_name?.charAt(0) || <UserCheck className="h-5 w-5" />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-foreground">{user.full_name || 'Unnamed'}</span>
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Mail className="h-3 w-3" />
                                                                    {user.email}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                                            {user.niy || '—'}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm text-muted-foreground">
                                                            {user.job_title || '—'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 text-sm text-foreground italic">
                                                            <Building className="h-4 w-4 text-muted-foreground" />
                                                            {user.department_name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{getRoleBadge(user.roles)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="glass-panel-strong w-48 p-1">
                                                                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</DropdownMenuLabel>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer rounded-md"
                                                                    onClick={() => {
                                                                        setEditingUser(user);
                                                                        setUserModalOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4 mr-2" />
                                                                    Edit User
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-border/50" />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-md font-semibold"
                                                                    onClick={() => {
                                                                        setItemToDelete({ type: 'user', item: user, permanent: false });
                                                                        setDeleteConfirmOpen(true);
                                                                    }}
                                                                >
                                                                    <Clock className="h-4 w-4 mr-2" />
                                                                    Suspend User
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-md font-bold"
                                                                    onClick={() => {
                                                                        setItemToDelete({ type: 'user', item: user, permanent: true });
                                                                        setDeleteConfirmOpen(true);
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Permanently Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Departments Tab */}
                <TabsContent value="departments">
                    <Card className="glass-panel border-border/30 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <FolderTree className="h-5 w-5 text-emerald-500" />
                                        Department Structure
                                    </CardTitle>
                                    <CardDescription>Manage organizational hierarchy</CardDescription>
                                </div>
                                <Button
                                    className="glow-primary"
                                    onClick={() => {
                                        setEditingDept(null);
                                        setDeptModalOpen(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Department
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                                    <p className="text-muted-foreground font-medium">Loading departments...</p>
                                </div>
                            ) : filteredDepts.length === 0 ? (
                                <div className="text-center py-20 border border-dashed rounded-xl bg-muted/20">
                                    <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                    <h3 className="text-lg font-semibold">No departments</h3>
                                    <p className="text-muted-foreground">Create your first department to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Global Level - Director */}
                                    <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ShieldAlert className="h-5 w-5 text-emerald-500" />
                                            <span className="font-bold text-lg">Global Level</span>
                                            <Badge variant="outline" className="text-[10px] uppercase bg-emerald-100 text-emerald-700 border-emerald-200">
                                                Organization Wide
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-4">
                                            Global roles apply across all departments. Director provides final approval, Admin manages system configuration.
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Director */}
                                            <div className="p-3 rounded-lg bg-background border">
                                                <Badge variant="outline" className="text-[10px] uppercase bg-emerald-100 text-emerald-700 border-emerald-200 mb-2">
                                                    Director
                                                </Badge>
                                                <div className="space-y-1">
                                                    {users.filter(u => u.roles?.includes('director')).slice(0, 3).map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => {
                                                                setEditingUser(u);
                                                                setUserModalOpen(true);
                                                            }}
                                                            className="flex items-center gap-2 text-xs w-full hover:bg-black/5 p-1 rounded transition-colors text-left"
                                                        >
                                                            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-[10px] font-bold shrink-0">
                                                                {u.full_name?.charAt(0) || '?'}
                                                            </div>
                                                            <span className="truncate flex-1 font-medium">{u.full_name || u.email}</span>
                                                        </button>
                                                    ))}
                                                    {users.filter(u => u.roles?.includes('director')).length === 0 && (
                                                        <span className="text-[10px] text-muted-foreground italic">No director assigned</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Admin */}
                                            <div className="p-3 rounded-lg bg-background border">
                                                <Badge variant="outline" className="text-[10px] uppercase bg-rose-100 text-rose-700 border-rose-200 mb-2">
                                                    Admin
                                                </Badge>
                                                <div className="space-y-1">
                                                    {users.filter(u => u.roles?.includes('admin')).slice(0, 3).map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => {
                                                                setEditingUser(u);
                                                                setUserModalOpen(true);
                                                            }}
                                                            className="flex items-center gap-2 text-xs w-full hover:bg-black/5 p-1 rounded transition-colors text-left"
                                                        >
                                                            <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 text-[10px] font-bold shrink-0">
                                                                {u.full_name?.charAt(0) || '?'}
                                                            </div>
                                                            <span className="truncate flex-1 font-medium">{u.full_name || u.email}</span>
                                                        </button>
                                                    ))}
                                                    {users.filter(u => u.roles?.includes('admin')).length === 0 && (
                                                        <span className="text-[10px] text-muted-foreground italic">No admin assigned</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Department Tree */}
                                    <div className="rounded-md border border-border/50 overflow-hidden">
                                        {getDeptTree()}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Workflows Tab */}
                <TabsContent value="workflows">
                    <WorkflowEditor departments={departments} />
                </TabsContent>

                <TabsContent value="reviews">
                    <AdminAssessmentReview />
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <UserManagementModal
                open={userModalOpen}
                onOpenChange={setUserModalOpen}
                user={editingUser}
                departments={departments}
                onSuccess={fetchData}
            />

            <DepartmentModal
                open={deptModalOpen}
                onOpenChange={setDeptModalOpen}
                department={editingDept}
                departments={departments}
                onSuccess={fetchData}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent className="glass-panel-strong">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Confirm {itemToDelete?.type === 'user' ? (itemToDelete.permanent ? 'Permanent Deletion' : 'Suspension') : 'Deletion'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {itemToDelete?.type === 'user'
                                ? itemToDelete.permanent
                                    ? `Are you sure you want to PERMANENTLY DELETE ${(itemToDelete.item as User).full_name || 'this user'}? This will remove all their data and cannot be undone.`
                                    : `Are you sure you want to suspend ${(itemToDelete.item as User).full_name || 'this user'}? They will no longer be able to access the system.`
                                : `Are you sure you want to delete the "${(itemToDelete?.item as Department)?.name}" department? This action cannot be undone.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {itemToDelete?.type === 'user' ? (itemToDelete.permanent ? 'Delete Permanently' : 'Suspend User') : 'Delete Department'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function AdminPage() {
    return (
        <ProtectedRoute requiredRoles={['admin']}>
            <div className="min-h-screen bg-background relative">
                <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
                <Header />
                <main className="container relative px-4 py-8">
                    <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-primary fixed top-1/2 left-1/2" />}>
                        <AdminContent />
                    </Suspense>
                </main>
            </div>
        </ProtectedRoute>
    );
}

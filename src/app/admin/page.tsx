'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
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

    FolderTree,
    Plus,
    Clock,

    FileText,
    BellRing
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';

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
import { DepartmentStructure } from '@/components/admin/DepartmentStructure';
import { WorkflowEditor } from '@/components/admin/WorkflowEditor';
import { AdminAssessmentReview } from '@/components/admin/AdminAssessmentReview';
import {
    DepartmentRoleAssignmentDialog,
    type DepartmentRoleAssignment,
} from '@/components/admin/DepartmentRoleAssignmentDialog';

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
    full_name: string | null;
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
    const [roleAssignments, setRoleAssignments] = useState<DepartmentRoleAssignment[]>([]);
    const [selectedRoleAssignment, setSelectedRoleAssignment] = useState<DepartmentRoleAssignment | null>(null);
    const [roleAssignmentOpen, setRoleAssignmentOpen] = useState(false);

    // Delete confirmation
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'user' | 'department'; item: User | Department; permanent?: boolean } | null>(null);


    const fetchData = useCallback(async () => {
        setLoading(true);
        const [usersRes, deptsRes, assignmentsRes] = await Promise.all([
            api.getAdminUsers(),
            api.getDepartments(),
            api.getDepartmentRoleMemberships(),
        ]);

        if (usersRes.error) {
            toast({ title: 'Unable to load users', description: usersRes.error.message, variant: 'destructive' });
        } else if (usersRes.data) {
            setUsers((usersRes.data as User[]).map(user => ({
                ...user,
                roles: user.roles || ['staff'],
                department_name: user.department_name || 'Unassigned'
            })));
        }

        if (deptsRes.error) {
            toast({ title: 'Unable to load departments', description: deptsRes.error.message, variant: 'destructive' });
        } else if (deptsRes.data) {
            setDepartments(deptsRes.data as Department[]);
        }

        if (assignmentsRes.error) {
            toast({ title: 'Unable to load role assignments', description: assignmentsRes.error.message, variant: 'destructive' });
        } else if (assignmentsRes.data) {
            setRoleAssignments(assignmentsRes.data as DepartmentRoleAssignment[]);
        }

        setLoading(false);
    }, [toast]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
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

    const getRoleBadge = (roles: unknown) => {
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
                            role === 'admin' ? 'bg-destructive-soft text-destructive border-destructive/40 hover:bg-destructive-soft' :
                                role === 'director' ? 'bg-success-soft text-success border-success/40 hover:bg-success-soft' :
                                    role === 'manager' ? 'bg-warning-soft text-warning-foreground border-warning/40 hover:bg-warning-soft' :
                                        'bg-primary-soft text-primary border-primary/40 hover:bg-primary-soft'
                        }
                    >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                ))}
            </div>
        );
    };



    const findRoleAssignment = (departmentId: string | null, role: string) =>
        roleAssignments.find(assignment =>
            assignment.department_id === departmentId && assignment.role === role
        ) ?? null;

    const manageRoleAssignment = (departmentId: string | null, role: string) => {
        const assignment = findRoleAssignment(departmentId, role);
        if (!assignment) {
            toast({
                title: 'Role configuration unavailable',
                description: 'Refresh the page and try again.',
                variant: 'destructive',
            });
            return;
        }
        setSelectedRoleAssignment(assignment);
        setRoleAssignmentOpen(true);
    };


    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive w-fit text-xs font-bold uppercase tracking-wider mb-2">
                        <Shield className="h-3 w-3" />
                        Control Center
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Administration</h1>
                    <p className="text-muted-foreground">Manage users, departments, and approval workflows.</p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto md:items-center">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href="/admin/notification-settings">
                            <BellRing className="mr-2 h-4 w-4" />
                            Notification settings
                        </Link>
                    </Button>
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
                        <div className="h-1 bg-gradient-to-r from-destructive/30 via-destructive to-destructive/30" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings2 className="h-5 w-5 text-destructive" />
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
                        <div className="h-1 bg-gradient-to-r from-success/30 via-success to-success/30" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <FolderTree className="h-5 w-5 text-success" />
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
                                    <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
                                    <p className="font-medium text-muted-foreground">Loading departments...</p>
                                </div>
                            ) : (
                                <DepartmentStructure
                                    departments={departments}
                                    roleAssignments={roleAssignments}
                                    onCreateDepartment={() => { setEditingDept(null); setDeptModalOpen(true); }}
                                    onEditDepartment={(department) => { setEditingDept(department); setDeptModalOpen(true); }}
                                    onDeleteDepartment={(department) => { setItemToDelete({ type: "department", item: department }); setDeleteConfirmOpen(true); }}
                                    onManageRole={manageRoleAssignment}
                                    onEditUser={(userId) => {
                                        const user = users.find((candidate) => candidate.id === userId);
                                        if (user) { setEditingUser(user); setUserModalOpen(true); }
                                    }}
                                />
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

            <DepartmentRoleAssignmentDialog
                open={roleAssignmentOpen}
                onOpenChange={setRoleAssignmentOpen}
                assignment={selectedRoleAssignment}
                users={users}
                onSaved={fetchData}
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
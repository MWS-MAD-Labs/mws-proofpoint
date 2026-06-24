'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';

interface Department {
    id: string;
    name: string;
}

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

interface UserManagementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: User | null; // null = create mode, User = edit mode
    departments: Department[];
    onSuccess: () => void;
}

const AVAILABLE_ROLES = ['admin', 'staff', 'manager', 'director'] as const;

export function UserManagementModal({
    open,
    onOpenChange,
    user,
    departments,
    onSuccess,
}: UserManagementModalProps) {
    const isEditMode = !!user;

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        niy: '',
        job_title: '',
        department_id: 'none',
        roles: ['staff'] as string[],
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                email: user.email || '',
                password: '',
                full_name: user.full_name || '',
                niy: user.niy || '',
                job_title: user.job_title || '',
                department_id: user.department_id || 'none',
                roles: user.roles?.length ? user.roles : ['staff'],
            });
        } else {
            setFormData({
                email: '',
                password: '',
                full_name: '',
                niy: '',
                job_title: '',
                department_id: 'none',
                roles: ['staff'],
            });
        }
        setError('');
    }, [user, open]);

    const handleRoleToggle = (role: string) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(role)
                ? prev.roles.filter(r => r !== role)
                : [...prev.roles, role],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            const finalDeptId = formData.department_id === 'none' ? undefined : formData.department_id;

            if (isEditMode && user) {
                const { error: updateError } = await api.updateUser(user.id, {
                    full_name: formData.full_name || undefined,
                    niy: formData.niy || undefined,
                    job_title: formData.job_title || undefined,
                    department_id: finalDeptId,
                    roles: formData.roles,
                    password: formData.password || undefined,
                });
                if (updateError) throw updateError;
            } else {
                if (!formData.email || !formData.password) {
                    throw new Error('Email and password are required');
                }
                const { error: createError } = await api.createUser({
                    email: formData.email,
                    password: formData.password,
                    full_name: formData.full_name || undefined,
                    niy: formData.niy || undefined,
                    job_title: formData.job_title || undefined,
                    department_id: finalDeptId,
                    roles: formData.roles,
                });
                if (createError) throw createError;
            }

            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] glass-panel-strong">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {isEditMode ? 'Edit User' : 'Create New User'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? 'Update user information and role assignments.'
                            : 'Add a new user to the system with their initial configuration.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                disabled={isEditMode}
                                placeholder="user@example.com"
                                className="glass-panel"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">
                                {isEditMode ? 'New Password (leave blank to keep current)' : 'Password'}
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                placeholder={isEditMode ? '••••••••' : 'Enter password'}
                                className="glass-panel"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input
                                id="full_name"
                                value={formData.full_name}
                                onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                placeholder="John Doe"
                                className="glass-panel"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="niy">NIY (Nomor Induk Yayasan)</Label>
                            <Input
                                id="niy"
                                value={formData.niy}
                                onChange={e => setFormData(prev => ({ ...prev, niy: e.target.value }))}
                                placeholder="e.g. 1234567890"
                                className="glass-panel"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="job_title">Job Title</Label>
                            <Input
                                id="job_title"
                                value={formData.job_title}
                                onChange={e => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                                placeholder="Software Engineer"
                                className="glass-panel"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="department">Department</Label>
                            <Select
                                value={formData.department_id}
                                onValueChange={value => setFormData(prev => ({ ...prev, department_id: value }))}
                            >
                                <SelectTrigger className="glass-panel">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent className="glass-panel-strong">
                                    <SelectItem value="none">No Department</SelectItem>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Roles</Label>
                            <div className="flex flex-wrap gap-4 p-3 rounded-md border border-border/50 bg-muted/20">
                                {AVAILABLE_ROLES.map(role => (
                                    <label
                                        key={role}
                                        className="flex items-center gap-2 cursor-pointer text-sm"
                                    >
                                        <Checkbox
                                            checked={formData.roles.includes(role)}
                                            onCheckedChange={() => handleRoleToggle(role)}
                                        />
                                        <span className="capitalize">{role}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Users can have multiple roles. Admin can be combined with other roles.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving} className="glow-primary">
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isEditMode ? 'Save Changes' : 'Create User'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

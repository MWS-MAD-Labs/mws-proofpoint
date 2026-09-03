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
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';

interface OrganizationAssignment {
    department_role_id: string;
    department_id: string | null;
    department_name: string | null;
    role: string;
}

interface User {
    id: string;
    email: string;
    full_name: string | null;
    niy: string | null;
    job_title: string | null;
    assignments: OrganizationAssignment[];
    roles: string[];
    status: string;
}

interface UserManagementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: User | null; // null = create mode, User = edit mode
    onSuccess: () => void;
}

export function UserManagementModal({
    open,
    onOpenChange,
    user,
    onSuccess,
}: UserManagementModalProps) {
    const isEditMode = !!user;

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        niy: '',
        job_title: '',
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
            });
        } else {
            setFormData({
                email: '',
                password: '',
                full_name: '',
                niy: '',
                job_title: '',
            });
        }
        setError('');
    }, [user, open]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            if (isEditMode && user) {
                const { error: updateError } = await api.updateUser(user.id, {
                    full_name: formData.full_name || undefined,
                    niy: formData.niy || undefined,
                    job_title: formData.job_title || undefined,
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
                            ? 'Update account and personal profile information.'
                            : 'Add a new account. Department access is assigned after creation.'}
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
                            <Label>Department and role assignments</Label>
                            <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                                {user?.assignments?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                        {user.assignments.map((assignment) => (
                                            <Badge key={assignment.department_role_id} variant="secondary" className="capitalize">
                                                {assignment.department_name ?? 'Global'} · {assignment.role}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm italic text-muted-foreground">No organizational assignments.</p>
                                )}
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Assignments are managed from Administration → Departments. A user can belong to more than one department.
                                </p>
                            </div>
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

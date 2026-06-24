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
    parent_id: string | null;
    parent_name: string | null;
}

interface DepartmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    department?: Department | null; // null = create mode, Department = edit mode
    departments: Department[];
    onSuccess: () => void;
}

export function DepartmentModal({
    open,
    onOpenChange,
    department,
    departments,
    onSuccess,
}: DepartmentModalProps) {
    const isEditMode = !!department;

    const [formData, setFormData] = useState({
        name: '',
        parent_id: 'none',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (department) {
            setFormData({
                name: department.name || '',
                parent_id: department.parent_id || 'none',
            });
        } else {
            setFormData({
                name: '',
                parent_id: 'none',
            });
        }
        setError('');
    }, [department, open]);

    // Filter out current department from parent options to prevent circular reference
    const parentOptions = departments.filter(d =>
        !department || d.id !== department.id
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            const finalParentId = formData.parent_id === 'none' ? null : formData.parent_id;

            if (isEditMode && department) {
                const { error: updateError } = await api.updateDepartment(department.id, {
                    name: formData.name,
                    parent_id: finalParentId,
                });
                if (updateError) throw updateError;
            } else {
                const { error: createError } = await api.createDepartment({
                    name: formData.name,
                    parent_id: finalParentId || undefined,
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
            <DialogContent className="sm:max-w-[425px] glass-panel-strong">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {isEditMode ? 'Edit Department' : 'Create New Department'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? 'Update department information and hierarchy.'
                            : 'Add a new department to the organization structure.'}
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
                            <Label htmlFor="name">Department Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Engineering"
                                className="glass-panel"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="parent">Parent Department (Optional)</Label>
                            <Select
                                value={formData.parent_id}
                                onValueChange={value => setFormData(prev => ({ ...prev, parent_id: value }))}
                            >
                                <SelectTrigger className="glass-panel">
                                    <SelectValue placeholder="No parent (top-level)" />
                                </SelectTrigger>
                                <SelectContent className="glass-panel-strong">
                                    <SelectItem value="none">No parent (top-level)</SelectItem>
                                    {parentOptions.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Select a parent to create a hierarchical structure.
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
                            {isEditMode ? 'Save Changes' : 'Create Department'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

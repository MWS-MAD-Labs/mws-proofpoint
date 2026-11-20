'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ListChecks, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CentralSyncSummary {
    created: number;
    linked: number;
    updated: number;
    unchanged: number;
    failed: number;
}

interface CentralStructureStatus {
    mode: 'applied' | 'held';
    departments: { linked: number; renamed: number; created: number };
    memberships: { added: number; removed: number };
    changes: string[];
}

export interface CentralSyncStatusResponse {
    enabled: boolean;
    managesDepartments: boolean;
    checkedAt: string | null;
    syncedAt: string | null;
    profilesSyncedAt: string | null;
    lastError: string | null;
    lastSummary: CentralSyncSummary | null;
    structure: CentralStructureStatus | null;
    warnings: string[];
    error?: string;
}

function formatTime(value: string | null): string {
    return value ? new Date(value).toLocaleString() : 'not yet';
}

function structureLine(structure: CentralStructureStatus): string {
    const { added, removed } = structure.memberships;
    const departments = structure.departments.created + structure.departments.linked + structure.departments.renamed;
    if (structure.mode === 'held') {
        return `Departments held, too much would be removed at once: ${added} membership(s) to add, ${removed} to remove. Check Central.`;
    }
    if (added + removed + departments === 0) return 'Departments match Central.';
    return `Departments updated from Central: ${added} membership(s) added, ${removed} removed, ${departments} department change(s).`;
}

// When ProofPoint last matched its accounts and departments with Central, what
// changed or would change, anything that needs an administrator, and Sync now.
export function CentralSyncStatus({
    onSynced,
    onStatus,
}: {
    onSynced?: () => void;
    onStatus?: (status: CentralSyncStatusResponse) => void;
}) {
    const { toast } = useToast();
    const [status, setStatus] = useState<CentralSyncStatusResponse | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [showWarnings, setShowWarnings] = useState(false);
    const [showChanges, setShowChanges] = useState(false);

    const update = useCallback((next: CentralSyncStatusResponse) => {
        setStatus(next);
        onStatus?.(next);
    }, [onStatus]);

    const load = useCallback(async () => {
        const response = await fetch('/api/admin/central-sync', { cache: 'no-store' });
        if (response.ok) update(await response.json());
    }, [update]);

    useEffect(() => {
        void load();
    }, [load]);

    const syncNow = async () => {
        setSyncing(true);
        try {
            const response = await fetch('/api/admin/central-sync', { method: 'POST' });
            const body = (await response.json()) as CentralSyncStatusResponse;
            if (!response.ok) {
                toast({ title: 'Central sync failed', description: body.error, variant: 'destructive' });
            } else {
                toast({ title: 'ProofPoint is in line with Central' });
                onSynced?.();
            }
            update({ ...(status ?? body), ...body, enabled: true });
        } catch {
            toast({ title: 'Central sync failed', variant: 'destructive' });
        } finally {
            setSyncing(false);
        }
    };

    if (!status?.enabled) return null;

    const summary = status.lastSummary;
    const structure = status.structure;
    const warnings = status.warnings ?? [];

    return (
        <div className="mb-4 rounded-lg border border-border/40 bg-card/60 px-4 py-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="font-medium">Central sync</p>
                    {status.managesDepartments && (
                        <p className="text-muted-foreground">
                            Users, roles and departments are managed in Central. Changes there show up here within a minute.
                        </p>
                    )}
                    <p className="text-muted-foreground">
                        Last synced {formatTime(status.syncedAt)}
                        {summary && (
                            <> · {summary.created} created, {summary.linked} linked, {summary.updated} updated
                                {summary.failed > 0 && <>, {summary.failed} failed</>}</>
                        )}
                    </p>
                    {structure && <p className="text-muted-foreground">{structureLine(structure)}</p>}
                    {status.lastError && (
                        <p className="text-destructive">Last check failed: {status.lastError}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {structure && structure.changes.length > 0 && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                                onClick={() => setShowChanges((open) => !open)}
                            >
                                <ListChecks className="h-3.5 w-3.5" />
                                {showChanges ? 'Hide' : 'Show'} {structure.changes.length} department change(s)
                            </button>
                        )}
                        {warnings.length > 0 && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-warning-foreground underline-offset-2 hover:underline"
                                onClick={() => setShowWarnings((open) => !open)}
                            >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {warnings.length} item{warnings.length === 1 ? '' : 's'} need attention
                            </button>
                        )}
                    </div>
                </div>
                <Button variant="outline" size="sm" disabled={syncing} onClick={() => void syncNow()}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing…' : 'Sync now'}
                </Button>
            </div>
            {showChanges && structure && structure.changes.length > 0 && (
                <ul className="mt-3 max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-muted-foreground">
                    {structure.changes.map((change) => (
                        <li key={change}>{change}</li>
                    ))}
                </ul>
            )}
            {showWarnings && warnings.length > 0 && (
                <ul className="mt-3 max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-muted-foreground">
                    {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}

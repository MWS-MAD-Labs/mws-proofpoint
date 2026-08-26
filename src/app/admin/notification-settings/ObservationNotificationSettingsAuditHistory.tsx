'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuditChange {
  field: string;
  before: boolean | number;
  after: boolean | number;
}

interface AuditEntry {
  id: string;
  createdAt: string;
  actor: { id: string; name: string | null; email: string };
  changes: AuditChange[];
}

interface AuditResponse {
  data: AuditEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const LABELS: Record<string, string> = {
  notificationsEnabled: 'Master notifications',
  submissionEmailsEnabled: 'Submission emails',
  reminderEmailsEnabled: 'Reminder emails',
  firstReminderDays: 'First reminder delay',
  reminderIntervalDays: 'Reminder interval',
  automaticAcknowledgementEnabled: 'Automatic acknowledgement',
  automaticAcknowledgementDays: 'Automatic acknowledgement deadline',
  personalAcknowledgementEmailsEnabled: 'Personal acknowledgement emails',
  automaticAcknowledgementEmailsEnabled: 'Automatic acknowledgement emails',
  reopenEmailsEnabled: 'Reopen emails',
  reassignmentEmailsEnabled: 'Reassignment emails',
  schedulerEnabled: 'Scheduler',
  schedulerIntervalMinutes: 'Scheduler interval',
};

const TIMING_FIELDS = new Set([
  'firstReminderDays',
  'reminderIntervalDays',
  'automaticAcknowledgementDays',
  'schedulerIntervalMinutes',
]);

function displayValue(value: boolean | number, field: string): string {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  return `${value} ${field === 'schedulerIntervalMinutes' ? 'minutes' : 'days'}`;
}

export function ObservationNotificationSettingsAuditHistory({ refreshToken }: { refreshToken: number }) {
  const [response, setResponse] = useState<AuditResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousRefreshToken = useRef(refreshToken);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiResponse = await fetch(
        `/api/admin/observation-notification-settings/history?page=${page}&pageSize=${pageSize}`,
        { cache: 'no-store' },
      );
      const payload = (await apiResponse.json().catch(() => null)) as (AuditResponse & { error?: string }) | null;
      if (!apiResponse.ok || !payload) throw new Error(payload?.error || 'Unable to load audit history.');
      setResponse(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit history.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    if (previousRefreshToken.current !== refreshToken && page !== 1) {
      previousRefreshToken.current = refreshToken;
      setPage(1);
      return;
    }

    previousRefreshToken.current = refreshToken;
    void loadHistory();
  }, [loadHistory, page, refreshToken]);

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Settings audit history
        </CardTitle>
        <CardDescription>Administrator changes are retained with before-and-after policy values.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !response ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading history...
          </div>
        ) : error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
        ) : response?.data.length ? (
          <div className="space-y-3">
            {response.data.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-border/50 bg-background/40 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{entry.actor.name || entry.actor.email}</p>
                    {entry.actor.name && <p className="text-xs text-muted-foreground">{entry.actor.email}</p>}
                  </div>
                  <time className="text-sm text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
                <div className="mt-3 space-y-2">
                  {entry.changes.map((change) => (
                    <div
                      key={change.field}
                      className={`rounded-lg px-3 py-2 text-sm ${TIMING_FIELDS.has(change.field) ? 'border border-warning/50 bg-warning-soft' : 'bg-muted/50'}`}
                    >
                      <span className="font-semibold">{LABELS[change.field] || change.field}:</span>{' '}
                      <span className="text-muted-foreground">{displayValue(change.before, change.field)}</span>
                      {' → '}
                      <span className="font-medium">{displayValue(change.after, change.field)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No administrator changes have been recorded.</p>
        )}

        {response && (
          <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {response.pagination.page} of {Math.max(1, response.pagination.totalPages)} · {response.pagination.total} changes
            </p>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={loading || page >= response.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

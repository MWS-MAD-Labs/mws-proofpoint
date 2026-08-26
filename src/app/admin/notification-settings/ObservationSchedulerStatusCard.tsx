'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SchedulerStatus {
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  settingsRevision: string | null;
  nextExpectedAt: string | null;
  advisoryLockSkips: number;
  counts: {
    checked: number;
    reminded: number;
    autoAcknowledged: number;
    skipped: number;
    failed: number;
  };
  lastError: string | null;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

export function ObservationSchedulerStatusCard({ refreshToken }: { refreshToken: number }) {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/observation-notification-settings/status', {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as { data?: SchedulerStatus; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'Unable to load scheduler status.');
      }
      setStatus(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load scheduler status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshToken]);

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            Scheduler status
          </CardTitle>
          <CardDescription>Read-only health from the most recent scheduler cycles across application replicas.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Status unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!error && status && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Last attempted cycle', formatDate(status.lastAttemptedAt)],
                ['Last successful cycle', formatDate(status.lastSuccessfulAt)],
                ['Settings revision used', formatDate(status.settingsRevision)],
                ['Next expected cycle', formatDate(status.nextExpectedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest authoritative cycle</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Checked', status.counts.checked],
                ['Reminded', status.counts.reminded],
                ['Auto-acknowledged', status.counts.autoAcknowledged],
                ['Skipped', status.counts.skipped],
                ['Failed', status.counts.failed],
                ['Lock skips', status.advisoryLockSkips],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
              </div>
            </div>
            {status.lastError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Last error</AlertTitle>
                <AlertDescription className="break-words">{status.lastError}</AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-success/40 bg-success-soft">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>No current scheduler error</AlertTitle>
                <AlertDescription>Advisory-lock skips are expected when another replica owns the cycle.</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

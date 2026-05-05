'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from '@/components/layout/Header';
import {
  Loader2, ClipboardList, CheckCircle2, Clock, Send, Eye,
  ChevronRight, User, BookOpen, Plus, X, AlertCircle, Shield,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Types ────────────────────────────────────────────────────────────────────

type ObservationStatus = 'draft' | 'pending' | 'submitted' | 'reviewed' | 'acknowledged';

interface Observation {
  id: string;
  status: ObservationStatus;
  staffId: string;
  managerId: string | null;
  rubricId: string;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  staff?:   { id: string; email: string; profile?: { fullName: string | null } };
  manager?: { id: string; email: string; profile?: { fullName: string | null } };
  rubric?:  { id: string; name: string };
  answers?: Answer[];
}

interface ObservationDetail extends Omit<Observation, 'rubric'> {
  rubric?: {
    id: string;
    name: string;
    sections: Section[];
  };
  updates?: StatusHistory[];
}

interface Section {
  id: string;
  name: string;
  weight: string | null;
  indicators: Indicator[];
}

interface Indicator {
  id: string;
  name: string;
  description?: string | null;
}

interface Answer {
  id: string;
  indicatorId: string;
  score: number;
  note?: string | null;
  evidence?: string | null;
}

interface StatusHistory {
  id: string;
  statusFrom: string;
  statusTo: string;
  notes: string | null;
  createdAt: string;
  updatedBy?: { id: string; email: string; profile?: { fullName: string | null } };
}

interface UserData {
  id: string;
  email: string;
  profile?: { fullName: string | null };
  roles?: string[];
}

interface RubricData {
  id: string;
  name: string;
}

// ─── Hook: session + role ─────────────────────────────────────────────────────

function useCurrentUser() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  if (!session?.user) {
    return {
      currentUser: null,
      roles: [] as string[],
      isManager:  false,
      isStaff:    false,
      isAdmin:    false,
      isDirector: false,
      isLoading,
    };
  }

  const roles: string[] = (session.user as any).roles ?? [];

  return {
    currentUser: {
      id:    (session.user as any).id as string,
      email: session.user.email ?? '',
      name:  session.user.name ?? null,
      roles,
    },
    roles,
    isManager:  roles.includes('manager') || roles.includes('admin'),
    isStaff:    roles.includes('staff'),
    isAdmin:    roles.includes('admin'),
    isDirector: roles.includes('director'),
    isLoading,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fullName(u?: { email: string; profile?: { fullName: string | null } | null }) {
  return u?.profile?.fullName || u?.email || '—';
}

// ─── Status Badge Config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  draft:        { label: 'Draft',        icon: Clock,        cls: 'bg-zinc-100 text-zinc-600 border-zinc-200'        },
  pending:      { label: 'Pending',      icon: Clock,        cls: 'bg-amber-50 text-amber-700 border-amber-200'      },
  submitted:    { label: 'Submitted',    icon: Send,         cls: 'bg-blue-50 text-blue-700 border-blue-200'         },
  reviewed:     { label: 'Reviewed',     icon: Eye,          cls: 'bg-purple-50 text-purple-700 border-purple-200'   },
  acknowledged: { label: 'Acknowledged', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, icon: Eye, cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Score Input Component (auto-save on blur) ────────────────────────────────

function ScoreInput({
  indicator,
  answer,
  disabled,
  onSave,
}: {
  indicator: Indicator;
  answer?: Answer;
  disabled: boolean;
  onSave: (indicatorId: string, score: number, note: string) => Promise<void>;
}) {
  const [score,   setScore]   = useState(answer?.score && answer.score > 0 ? answer.score.toString() : '');
  const [note,    setNote]    = useState(answer?.note ?? '');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    setScore(answer?.score && answer.score > 0 ? answer.score.toString() : '');
    setNote(answer?.note ?? '');
  }, [answer?.score, answer?.note]);

  const handleSave = async () => {
    const num = Number(score);
    if (!score || isNaN(num) || disabled) return;
    setSaving(true);
    try {
      await onSave(indicator.id, num, note);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const isFilled = score !== '' && Number(score) > 0;

  return (
    <div className={`border rounded-xl p-4 mb-3 bg-card transition-colors ${
      isFilled ? 'border-border' : 'border-border/50 hover:border-border'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isFilled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
            <p className="font-medium text-foreground text-sm">{indicator.name}</p>
          </div>
          {indicator.description && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-3.5">{indicator.description}</p>
          )}
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-2 flex-shrink-0" />}
        {saved && !saving && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-2 flex-shrink-0" />}
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-shrink-0">
          <label className="block text-xs text-muted-foreground mb-1 font-medium">Score (1–100)</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onBlur={handleSave}
            disabled={disabled}
            placeholder="1–100"
            className="w-24"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-muted-foreground mb-1 font-medium">Notes</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleSave}
            disabled={disabled}
            rows={2}
            placeholder="Write observation notes..."
            className="resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ObservationsPage() {
  const {
    currentUser, roles, isManager, isStaff, isAdmin, isDirector, isLoading: sessionLoading,
  } = useCurrentUser();

  const [observations,      setObservations]      = useState<Observation[]>([]);
  const [selected,          setSelected]          = useState<ObservationDetail | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [loadingDetail,     setLoadingDetail]     = useState(false);
  const [actionLoading,     setActionLoading]     = useState(false);
  const [alert,             setAlert]             = useState<{ type: 'error'|'success'; message: string } | null>(null);

  const [staffList,   setStaffList]   = useState<UserData[]>([]);
  const [managerList, setManagerList] = useState<UserData[]>([]);
  const [rubricList,  setRubricList]  = useState<RubricData[]>([]);
  const [form,        setForm]        = useState({ staffId: '', managerId: '', rubricId: '' });
  const [creating,    setCreating]    = useState(false);
  const [showForm,    setShowForm]    = useState(false);

  const showAlert = (type: 'error'|'success', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchObservations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/observations');
      if (!res.ok) return;
      const json = await res.json();
      const list: Observation[] = Array.isArray(json) ? json : [];
      setObservations(list);
      if (list.length > 0 && !selected) {
        loadDetail(list[0].id);
      }
    } catch (err) {
      console.error('fetchObservations error:', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFormData = useCallback(async () => {
    if (!isAdmin && !isManager) return;
    try {
      const [resStaff, resManagers, resRubrics] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/managers'),
        fetch('/api/rubrics'),
      ]);

      const rawStaff    = await resStaff.json();
      const rawManagers = await resManagers.json();
      const rawRubrics  = await resRubrics.json();

      setStaffList(Array.isArray(rawStaff?.data) ? rawStaff.data : Array.isArray(rawStaff) ? rawStaff : []);
      setManagerList(Array.isArray(rawManagers) ? rawManagers : []);
      setRubricList(Array.isArray(rawRubrics) ? rawRubrics : Array.isArray(rawRubrics?.data) ? rawRubrics.data : []);
    } catch (err) {
      console.error('fetchFormData error:', err);
    }
  }, [isAdmin, isManager]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/observations/${id}`);
      if (!res.ok) return;
      setSelected(await res.json());
    } catch (err) {
      console.error('loadDetail error:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && currentUser) {
      fetchObservations();
      fetchFormData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, currentUser?.id]);

  // ── Actions ───────────────────────────────────────────────────────────

  const createObservation = async () => {
    if (!form.staffId || !form.rubricId) {
      showAlert('error', 'Please select a staff member and rubric.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId:   form.staffId,
          rubricId:  form.rubricId,
          managerId: isAdmin ? (form.managerId && form.managerId !== 'self' ? form.managerId : undefined) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showAlert('error', json.error || 'Failed to create observation.');
        return;
      }
      setForm({ staffId: '', managerId: '', rubricId: '' });
      setShowForm(false);
      showAlert('success', 'Observation created and manager has been notified.');
      await fetchObservations();
      await loadDetail(json.id);
    } catch {
      showAlert('error', 'A network error occurred.');
    } finally {
      setCreating(false);
    }
  };

  const saveAnswer = async (indicatorId: string, score: number, note: string) => {
    if (!selected) return;
    const res = await fetch('/api/observations/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observationId: selected.id, indicatorId, score, note }),
    });
    if (!res.ok) {
      const json = await res.json();
      showAlert('error', json.error || 'Failed to save answer.');
      return;
    }
    await loadDetail(selected.id);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/observations/${selected.id}/submit`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to submit.'); return; }
      showAlert('success', 'Observation submitted. Staff will receive an email notification.');
      await fetchObservations();
      await loadDetail(selected.id);
    } catch {
      showAlert('error', 'A network error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/observations/${selected.id}/acknowledge`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) { showAlert('error', json.error || 'Failed to acknowledge.'); return; }
      showAlert('success', 'Observation acknowledged successfully.');
      await fetchObservations();
      await loadDetail(selected.id);
    } catch {
      showAlert('error', 'A network error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────

  const allIndicators = selected?.rubric?.sections?.flatMap((s) => s.indicators) ?? [];

  const filledCount = allIndicators.filter((ind) =>
    selected?.answers?.some((a) => a.indicatorId === ind.id && a.score > 0)
  ).length;

  const canEdit =
    selected?.status === 'draft' &&
    (selected?.managerId === currentUser?.id || isAdmin);

  const canSubmit = canEdit && filledCount > 0;

  const canAcknowledge =
    selected?.status === 'submitted' &&
    (selected?.staffId === currentUser?.id || isAdmin);

  const canCreate = isAdmin || isManager;

  // ── Render ────────────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-8 max-w-6xl">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Observations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin
                ? 'Manage all observations — create and assign to managers'
                : isDirector
                ? 'Monitor all completed observations'
                : isManager
                ? 'Fill in observation forms assigned to you'
                : 'View and acknowledge your observation results'}
            </p>
            <div className="flex gap-1 mt-2">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs capitalize">
                  {r === 'admin' ? 'Admin'
                    : r === 'manager' ? 'Manager'
                    : r === 'director' ? 'Director'
                    : 'Staff'}
                </Badge>
              ))}
            </div>
          </div>

          {canCreate && (
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Close' : 'New Observation'}
            </Button>
          )}
        </div>

        {/* Alert */}
        {alert && (
          <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}

        {/* ── Create Observation Form ─────────────────────────────── */}
        {showForm && canCreate && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                New Observation
                {isAdmin && (
                  <span className="text-xs text-muted-foreground font-normal">(Admin)</span>
                )}
                {!isAdmin && isManager && (
                  <span className="text-xs text-muted-foreground font-normal">(Manager)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${isAdmin ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>

                {/* Select Staff */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Staff to observe <span className="text-destructive">*</span>
                  </label>
                  <Select value={form.staffId} onValueChange={(val) => setForm({ ...form, staffId: val })}>
                    <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.profile?.fullName || s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select Rubric */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Rubric form <span className="text-destructive">*</span>
                  </label>
                  <Select value={form.rubricId} onValueChange={(val) => setForm({ ...form, rubricId: val })}>
                    <SelectTrigger><SelectValue placeholder="Select rubric..." /></SelectTrigger>
                    <SelectContent>
                      {rubricList.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select Manager — Admin only */}
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Assign to Manager
                      <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                    </label>
                    <Select value={form.managerId} onValueChange={(val) => setForm({ ...form, managerId: val })}>
                      <SelectTrigger><SelectValue placeholder="Default (myself)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Default (myself)</SelectItem>
                        {managerList.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.profile?.fullName || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button
                  onClick={createObservation}
                  disabled={creating || !form.staffId || !form.rubricId}
                  className="gap-2"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create &amp; Assign
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Main Grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-6">

          {/* Left: Observation List */}
          <div className="col-span-2">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {observations.length} Observation{observations.length !== 1 ? 's' : ''}
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : observations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <ClipboardList className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No observations yet</p>
                  {canCreate && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Click &quot;New Observation&quot; to get started
                    </p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {observations.map((obs) => (
                    <button
                      key={obs.id}
                      onClick={() => loadDetail(obs.id)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-muted/30 transition-colors flex items-center justify-between group ${
                        selected?.id === obs.id
                          ? 'bg-muted/50 border-l-2 border-l-primary'
                          : 'border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">
                            {fullName(obs.staff)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={obs.status} />
                          {obs.rubric?.name && (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {obs.rubric.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Observation Detail */}
          <div className="col-span-3">
            {!selected ? (
              <Card className="flex flex-col items-center justify-center py-24 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Select an observation from the list</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Details will appear here</p>
              </Card>
            ) : loadingDetail ? (
              <Card className="flex items-center justify-center py-24">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </Card>
            ) : (
              <Card className="overflow-hidden">

                {/* Detail Header */}
                <div className="px-6 py-4 border-b border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold text-foreground">
                      {selected.rubric?.name ?? 'Observation Detail'}
                    </h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Staff: <strong className="text-foreground ml-1">{fullName(selected.staff)}</strong>
                    </span>
                    <span>
                      Manager: <strong className="text-foreground">{fullName(selected.manager)}</strong>
                    </span>
                    {selected.submittedAt && (
                      <span>Submitted: {new Date(selected.submittedAt).toLocaleDateString('en-GB')}</span>
                    )}
                    {selected.acknowledgedAt && (
                      <span>Acknowledged: {new Date(selected.acknowledgedAt).toLocaleDateString('en-GB')}</span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {canEdit && allIndicators.length > 0 && (
                  <div className="px-6 py-3 bg-muted/30 border-b border-border/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Completion progress</span>
                      <span className="text-xs font-medium text-foreground">
                        {filledCount} / {allIndicators.length} indicators
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${allIndicators.length > 0 ? (filledCount / allIndicators.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Sections & Indicators */}
                <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
                  {!selected.rubric?.sections || selected.rubric.sections.length === 0 ? (
                    <div className="text-center py-10">
                      <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-destructive font-medium">This rubric has no sections or indicators</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add sections &amp; indicators to this rubric in the Rubrics menu
                      </p>
                    </div>
                  ) : (
                    selected.rubric.sections.map((section) => (
                      <div key={section.id} className="mb-6">
                        <div className="flex items-center gap-2 mb-3 pb-1 border-b border-border/50">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {section.name}
                          </h3>
                          {section.weight && (
                            <span className="text-xs text-muted-foreground">weight {section.weight}%</span>
                          )}
                        </div>

                        {section.indicators.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic px-1">
                            No indicators in this section
                          </p>
                        ) : section.indicators.map((indicator) => {
                          const answer = selected.answers?.find((a) => a.indicatorId === indicator.id);

                          if (!canEdit) {
                            return (
                              <div key={indicator.id} className="border border-border/50 rounded-xl p-4 mb-3 bg-muted/20">
                                <p className="text-sm font-medium text-foreground mb-2">{indicator.name}</p>
                                {indicator.description && (
                                  <p className="text-xs text-muted-foreground mb-3">{indicator.description}</p>
                                )}
                                {answer && answer.score > 0 ? (
                                  <div className="flex gap-6">
                                    <div>
                                      <span className="text-xs text-muted-foreground block mb-0.5">Score</span>
                                      <span className="text-2xl font-bold text-foreground">{answer.score}</span>
                                      <span className="text-xs text-muted-foreground ml-1">/ 100</span>
                                    </div>
                                    {answer.note && (
                                      <div className="flex-1">
                                        <span className="text-xs text-muted-foreground block mb-0.5">Notes</span>
                                        <p className="text-sm text-foreground">{answer.note}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    Not yet filled in by manager
                                  </p>
                                )}
                              </div>
                            );
                          }

                          return (
                            <ScoreInput
                              key={indicator.id}
                              indicator={indicator}
                              answer={answer}
                              disabled={false}
                              onSave={saveAnswer}
                            />
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Status History */}
                {selected.updates && selected.updates.length > 0 && (
                  <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Status History
                    </h4>
                    <div className="space-y-2">
                      {selected.updates.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-medium text-foreground">
                            {entry.updatedBy?.profile?.fullName || entry.updatedBy?.email || '—'}
                          </span>
                          <span>changed from</span>
                          <StatusBadge status={entry.statusFrom} />
                          <span>to</span>
                          <StatusBadge status={entry.statusTo} />
                          <span className="ml-auto">
                            {new Date(entry.createdAt).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Footer */}
                {(canSubmit || canAcknowledge) && (
                  <div className="px-6 py-4 border-t border-border/50 bg-muted/20">

                    {canSubmit && (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs text-muted-foreground">
                          {filledCount < allIndicators.length
                            ? `${allIndicators.length - filledCount} indicator(s) remaining`
                            : '✓ All indicators completed'}
                        </p>
                        <Button onClick={handleSubmit} disabled={actionLoading} className="gap-2 flex-shrink-0">
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Submit Observation
                        </Button>
                      </div>
                    )}

                    {canAcknowledge && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Have you reviewed the observation results?</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Click Acknowledge to confirm you have read this result.
                          </p>
                        </div>
                        <Button
                          onClick={handleAcknowledge}
                          disabled={actionLoading}
                          className="gap-2 flex-shrink-0 bg-emerald-600 hover:bg-emerald-700"
                        >
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Acknowledge
                        </Button>
                      </div>
                    )}
                  </div>
                )}

              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
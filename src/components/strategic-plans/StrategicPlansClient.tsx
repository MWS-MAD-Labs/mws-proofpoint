/* eslint-disable */
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api-client";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  DollarSign,
  FileText,
  Layers3,
  Loader2,
  Plus,
  Printer,
  Search,
  Target,
  Users,
} from "lucide-react";

type Mode = "list" | "new" | "detail" | "edit" | "budget" | "print";
type SelectedItem =
  | { type: "plan"; id: string }
  | { type: "goal"; id: string }
  | { type: "objective"; id: string }
  | { type: "program"; id: string };

const programStatuses = [
  "not_started",
  "on_track",
  "at_risk",
  "off_track",
  "completed",
];
const statusLabel: Record<string, string> = {
  not_started: "Not started",
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  completed: "Completed",
};

async function jsonFetch<T>(url: string, options?: RequestInit) {
  const isForm = options?.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: isForm
      ? options?.headers
      : { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || `Request failed (${response.status})`);
  return payload.data as T;
}

function Shell({
  children,
  print = false,
}: {
  children: React.ReactNode;
  print?: boolean;
}) {
  if (print)
    return (
      <div className="min-h-screen bg-white text-black p-8 print:p-0">
        {children}
      </div>
    );
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
        <div className="fixed inset-0 mesh-gradient opacity-30 pointer-events-none" />
        <Header />
        <main className="container relative mx-auto px-4 py-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized =
    statusLabel[status] ?? status?.replaceAll("_", " ") ?? "unknown";
  const tone =
    status === "published" || status === "completed" || status === "on_track"
      ? "default"
      : "outline";
  return (
    <Badge variant={tone as "default" | "outline"} className="capitalize">
      {normalized}
    </Badge>
  );
}

function EmptyState({
  icon: Icon = FileText,
  title,
  description,
}: {
  icon?: any;
  title: string;
  description: string;
}) {
  return (
    <Card className="glass-panel border-border/30">
      <CardContent className="py-12 text-center text-muted-foreground">
        <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

function flattenPrograms(plan: any) {
  return (plan?.goals ?? []).flatMap((goal: any) =>
    (goal.objectives ?? []).flatMap((objective: any) =>
      (objective.programs ?? []).map((program: any) => ({
        ...program,
        objective,
        goal,
      })),
    ),
  );
}

function planStats(plan: any) {
  const goals = plan?.goals ?? [];
  const objectives = goals.flatMap((goal: any) => goal.objectives ?? []);
  const programs = flattenPrograms(plan);
  const statusCounts = programs.reduce(
    (acc: Record<string, number>, program: any) => {
      acc[program.status] = (acc[program.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const missingKpis = programs.filter(
    (program: any) => (program.kpi_links ?? []).length === 0,
  ).length;
  const missingTargets = programs.filter((program: any) =>
    (program.targets ?? []).some((target: any) => !target.target_text),
  ).length;
  const totalBudget = programs.reduce(
    (sum: number, program: any) =>
      sum +
      (program.budget ?? []).reduce(
        (inner: number, line: any) => inner + Number(line.amount_idr ?? 0),
        0,
      ),
    0,
  );
  return {
    goals: goals.length,
    objectives: objectives.length,
    programs: programs.length,
    statusCounts,
    missingKpis,
    missingTargets,
    totalBudget,
  };
}

export function StrategicPlansClient({
  mode,
  planId,
  initialSelected,
}: {
  mode: Mode;
  planId?: string;
  initialSelected?: SelectedItem;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, isAdmin, isDirector, isManager } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [plan, setPlan] = useState<any | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const programIdParam = searchParams.get("programId");
  const objectiveIdParam = searchParams.get("objectiveId");
  const goalIdParam = searchParams.get("goalId");
  const selectedFromUrl: SelectedItem | undefined = programIdParam
    ? { type: "program", id: programIdParam }
    : objectiveIdParam
      ? { type: "objective", id: objectiveIdParam }
      : goalIdParam
        ? { type: "goal", id: goalIdParam }
        : undefined;

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (mode === "list") {
        setPlans(await jsonFetch<any[]>("/api/strategic-plans"));
      }
      if (["new", "detail", "edit", "budget"].includes(mode)) {
        const deptRes = await api.getDepartments();
        setDepartments((deptRes.data as any[]) ?? []);
      }
      if (planId && mode !== "list" && mode !== "new") {
        setPlan(await jsonFetch<any>(`/api/strategic-plans/${planId}`));
      }
    } catch (error) {
      toast({
        title: "Strategic plans",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [mode, planId]);

  if (mode === "print" && planId) return <PrintView planId={planId} />;

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading strategic plans…
        </div>
      </Shell>
    );
  }

  if (mode === "new") {
    return (
      <Shell>
        <PlanCreateWizard
          departments={departments}
          defaultDepartmentId={profile?.department_id ?? undefined}
          onSaved={(id) => router.push(`/strategic-plans/${id}/edit`)}
        />
      </Shell>
    );
  }

  if (mode === "edit" && plan) {
    return (
      <Shell>
        <DocumentBuilder
          plan={plan}
          departments={departments}
          initialSelected={selectedFromUrl ?? initialSelected}
          onReload={() => load(true)}
        />
      </Shell>
    );
  }

  if (mode === "budget" && plan) {
    return (
      <Shell>
        <BudgetView plan={plan} />
      </Shell>
    );
  }

  if (mode === "detail" && plan) {
    return (
      <Shell>
        <PlanOverview plan={plan} onReload={load} />
      </Shell>
    );
  }

  return (
    <Shell>
      <PlanList plans={plans} canCreate={isAdmin || isDirector || isManager} />
    </Shell>
  );
}

function PlanList({ plans, canCreate }: { plans: any[]; canCreate: boolean }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Badge className="mb-3 bg-primary/10 text-primary border border-primary/20">
            <Target className="h-3.5 w-3.5 mr-1" /> Strategic Plans
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Department strategic plans
          </h1>
          <p className="text-muted-foreground mt-2">
            A clearer planning workspace for goals, objectives, programs,
            targets, budget, and evidence.
          </p>
        </div>
        {canCreate && (
          <Link href="/strategic-plans/new">
            <Button className="glow-primary">
              <Plus className="h-4 w-4 mr-2" /> Create Strategic Plan
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const completion =
            Number(plan.program_count ?? 0) > 0
              ? Math.round(
                  (Number(plan.completed_program_count ?? 0) /
                    Number(plan.program_count)) *
                    100,
                )
              : 0;
          return (
            <Card
              key={plan.id}
              className="glass-panel border-border/30 hover-lift overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{plan.department_name}</CardTitle>
                    <CardDescription>
                      {plan.start_year}–{plan.end_year}
                    </CardDescription>
                  </div>
                  <StatusBadge status={plan.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <h3 className="font-semibold leading-tight">{plan.name}</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <b>{plan.goal_count ?? 0}</b>
                    <br />
                    Goals
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <b>{plan.program_count ?? 0}</b>
                    <br />
                    Programs
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <b>{completion}%</b>
                    <br />
                    Done
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/strategic-plans/${plan.id}`} className="flex-1">
                    <Button className="w-full" variant="outline">
                      Overview
                    </Button>
                  </Link>
                  <Link
                    href={`/strategic-plans/${plan.id}/edit`}
                    className="flex-1"
                  >
                    <Button className="w-full">Edit</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {plans.length === 0 && (
        <EmptyState
          title="No strategic plans yet"
          description="Create the first department plan or publish a draft so more users can see it."
        />
      )}
    </div>
  );
}

function PlanCreateWizard({
  departments,
  defaultDepartmentId,
  onSaved,
}: {
  departments: any[];
  defaultDepartmentId?: string;
  onSaved: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const defaultStartYear = new Date().getFullYear() + 1;
  const [form, setForm] = useState({
    departmentId: defaultDepartmentId ?? departments[0]?.id ?? "",
    name: "",
    startYear: defaultStartYear,
    description: "",
    vision: "",
    mission: "",
  });

  useEffect(() => {
    const autoDepartmentId = defaultDepartmentId ?? departments[0]?.id ?? "";
    setForm((current) => ({
      ...current,
      departmentId: current.departmentId || autoDepartmentId,
      startYear: current.startYear || defaultStartYear,
    }));
  }, [defaultDepartmentId, departments, defaultStartYear]);

  const save = async () => {
    setSaving(true);
    try {
      const plan = await jsonFetch<{ id: string }>("/api/strategic-plans", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast({
        title: "Strategic plan created",
        description:
          "Now use the document builder to add goals, objectives, and programs.",
      });
      onSaved(plan.id);
    } catch (error) {
      toast({
        title: "Create failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/strategic-plans" className="text-sm text-primary">
          ← Back to strategic plans
        </Link>
        <h1 className="text-4xl font-bold mt-2">Create strategic plan</h1>
        <p className="text-muted-foreground mt-2">
          Department and 5-year horizon are selected automatically. Add the
          vision and mission to create the plan shell.
        </p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Vision and mission</CardTitle>
          <CardDescription>
            The plan will be created for{" "}
            <span className="font-medium text-foreground">
              {departments.find(
                (department) => department.id === form.departmentId,
              )?.name ?? "your department"}
            </span>{" "}
            with a fixed horizon of {form.startYear}–
            {Number(form.startYear) + 4}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Vision</Label>
              <Textarea
                className="min-h-48"
                value={form.vision}
                onChange={(event) =>
                  setForm({ ...form, vision: event.target.value })
                }
                placeholder="Describe the future state this department is working toward."
              />
            </div>
            <div>
              <Label>Mission</Label>
              <Textarea
                className="min-h-48"
                value={form.mission}
                onChange={(event) =>
                  setForm({ ...form, mission: event.target.value })
                }
                placeholder="Describe how the department will achieve the vision."
              />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <BookOpen className="h-5 w-5 text-primary" />
              {form.startYear}–{Number(form.startYear) + 4} Strategic Plan
            </div>
            <p className="text-sm text-muted-foreground">
              Department:{" "}
              {departments.find(
                (department) => department.id === form.departmentId,
              )?.name ?? "Automatically selected"}
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button disabled={saving || !form.departmentId} onClick={save}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create and open builder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanOverview({
  plan,
  onReload,
}: {
  plan: any;
  onReload: () => Promise<void>;
}) {
  const stats = planStats(plan);
  const programs = flattenPrograms(plan);
  const [activeTab, setActiveTab] = useState("overview");

  const publishToggle = async () => {
    try {
      await jsonFetch(
        `/api/strategic-plans/${plan.id}/${plan.status === "published" ? "unpublish" : "publish"}`,
        { method: "POST" },
      );
      await onReload();
    } catch (error) {
      toast({
        title: "Status update failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <StatusBadge status={plan.status} />
            <Badge variant="outline">{plan.department_name}</Badge>
            <Badge variant="outline">
              {plan.start_year}–{plan.end_year}
            </Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{plan.name}</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            {plan.description || "No description yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="glow-primary"
            onClick={() => {
              setActiveTab("overview");
              setTimeout(() => {
                document
                  .getElementById("program-progress-updates")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Update Progress
          </Button>
          <Link href={`/strategic-plans/${plan.id}/edit`}>
            <Button variant="outline">
              <Layers3 className="h-4 w-4 mr-2" />
              Open builder
            </Button>
          </Link>
          <Link href={`/strategic-plans/${plan.id}/budget`}>
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Budget
            </Button>
          </Link>
          <Link href={`/strategic-plans/${plan.id}/print`}>
            <Button variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </Link>
          <Button variant="outline" onClick={publishToggle}>
            {plan.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric title="Goals" value={stats.goals} icon={Target} />
        <Metric
          title="Objectives"
          value={stats.objectives}
          icon={ClipboardList}
        />
        <Metric title="Programs" value={stats.programs} icon={Layers3} />
        <Metric
          title="Missing KPIs"
          value={stats.missingKpis}
          icon={AlertTriangle}
        />
        <Metric
          title="Budget"
          value={`IDR ${stats.totalBudget.toLocaleString("id-ID")}`}
          icon={DollarSign}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="targets">Targets matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <NarrativeCard title="Vision" text={plan.vision} />
            <NarrativeCard title="Mission" text={plan.mission} />
          </div>
          <ProgramProgressPanel programs={programs} onReload={onReload} />
        </TabsContent>
        <TabsContent value="structure">
          <ReadOnlyStructure plan={plan} />
        </TabsContent>
        <TabsContent value="programs">
          <ProgramDirectory plan={plan} />
        </TabsContent>
        <TabsContent value="targets">
          <TargetsMatrix plan={plan} />
        </TabsContent>
      </Tabs>

      {programs.length === 0 && (
        <EmptyState
          icon={Layers3}
          title="No programs yet"
          description="Open the builder and add goals, objectives, and programs to start tracking execution."
        />
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: any;
}) {
  return (
    <Card className="glass-panel border-border/30">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NarrativeCard({
  title,
  text,
}: {
  title: string;
  text?: string | null;
}) {
  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground whitespace-pre-wrap">
        {text || "Not written yet."}
      </CardContent>
    </Card>
  );
}

function DocumentBuilder({
  plan,
  departments,
  initialSelected,
  onReload,
}: {
  plan: any;
  departments: any[];
  initialSelected?: SelectedItem;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedItem>(
    initialSelected ?? {
      type: "plan",
      id: plan.id,
    },
  );
  const stats = planStats(plan);

  const handleSelect = (item: SelectedItem) => {
    setSelected(item);
    const queryKey =
      item.type === "program"
        ? "programId"
        : item.type === "objective"
          ? "objectiveId"
          : item.type === "goal"
            ? "goalId"
            : null;
    const suffix = queryKey ? `?${queryKey}=${item.id}` : "";
    router.replace(`/strategic-plans/${plan.id}/edit${suffix}`, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (initialSelected && findSelected(plan, initialSelected)) {
      setSelected(initialSelected);
    }
  }, [initialSelected?.type, initialSelected?.id, plan.id, plan.goals]);

  useEffect(() => {
    if (selected.type === "plan") return;
    if (!findSelected(plan, selected))
      setSelected({ type: "plan", id: plan.id });
  }, [plan.id, plan.goals, selected]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <Link
            href={`/strategic-plans/${plan.id}`}
            className="text-sm text-primary"
          >
            ← Back to overview
          </Link>
          <h1 className="text-4xl font-bold mt-2">Strategic plan builder</h1>
          <p className="text-muted-foreground mt-2">
            Use the outline to select one item at a time. This replaces the old
            expanded tree editor.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/strategic-plans/${plan.id}/print`}>
            <Button variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid xl:grid-cols-[320px_1fr_280px] gap-5 items-start">
        <PlanOutline plan={plan} selected={selected} onSelect={handleSelect} />
        <FocusedEditor
          plan={plan}
          selected={selected}
          departments={departments}
          onReload={onReload}
          onSelect={handleSelect}
        />
        <PlanHealth plan={plan} stats={stats} />
      </div>
    </div>
  );
}

function PlanOutline({
  plan,
  selected,
  onSelect,
}: {
  plan: any;
  selected: SelectedItem;
  onSelect: (item: SelectedItem) => void;
}) {
  return (
    <Card className="glass-panel border-border/30 sticky top-24 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Plan outline
        </CardTitle>
        <CardDescription>Select one item to edit.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 overflow-y-auto space-y-1">
        <OutlineButton
          active={selected.type === "plan"}
          depth={0}
          icon={FileText}
          label="Plan metadata"
          onClick={() => onSelect({ type: "plan", id: plan.id })}
        />
        {(plan.goals ?? []).map((goal: any) => (
          <div key={goal.id}>
            <OutlineButton
              active={selected.type === "goal" && selected.id === goal.id}
              depth={0}
              icon={Target}
              label={`Goal ${goal.number}: ${goal.title}`}
              onClick={() => onSelect({ type: "goal", id: goal.id })}
            />
            {(goal.objectives ?? []).map((objective: any) => (
              <div key={objective.id}>
                <OutlineButton
                  active={
                    selected.type === "objective" &&
                    selected.id === objective.id
                  }
                  depth={1}
                  icon={ClipboardList}
                  label={`Objective ${objective.number}: ${objective.title}`}
                  onClick={() =>
                    onSelect({ type: "objective", id: objective.id })
                  }
                />
                {(objective.programs ?? []).map((program: any) => (
                  <OutlineButton
                    key={program.id}
                    active={
                      selected.type === "program" && selected.id === program.id
                    }
                    depth={2}
                    icon={Circle}
                    label={`${program.code}: ${program.title}`}
                    right={<StatusDot status={program.status} />}
                    onClick={() =>
                      onSelect({ type: "program", id: program.id })
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OutlineButton({
  active,
  depth,
  icon: Icon,
  label,
  right,
  onClick,
}: {
  active: boolean;
  depth: number;
  icon: any;
  label: string;
  right?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted/70 text-foreground"}`}
      style={{ paddingLeft: `${12 + depth * 20}px` }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="line-clamp-2 flex-1">{label}</span>
      {right}
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "bg-green-500"
      : status === "on_track"
        ? "bg-blue-500"
        : status === "at_risk"
          ? "bg-yellow-500"
          : status === "off_track"
            ? "bg-red-500"
            : "bg-muted-foreground";
  return (
    <span
      className={`h-2 w-2 rounded-full ${color}`}
      title={statusLabel[status] ?? status}
    />
  );
}

function findSelected(plan: any, selected: SelectedItem) {
  if (selected.type === "plan") return plan;
  for (const goal of plan.goals ?? []) {
    if (selected.type === "goal" && goal.id === selected.id) return goal;
    for (const objective of goal.objectives ?? []) {
      if (selected.type === "objective" && objective.id === selected.id)
        return objective;
      for (const program of objective.programs ?? [])
        if (selected.type === "program" && program.id === selected.id)
          return program;
    }
  }
  return null;
}

function findParent(plan: any, selected: SelectedItem) {
  for (const goal of plan.goals ?? []) {
    for (const objective of goal.objectives ?? []) {
      if (selected.type === "objective" && objective.id === selected.id)
        return { goal };
      for (const program of objective.programs ?? [])
        if (selected.type === "program" && program.id === selected.id)
          return { goal, objective };
    }
  }
  return {};
}

function FocusedEditor({
  plan,
  selected,
  departments,
  onReload,
  onSelect,
}: {
  plan: any;
  selected: SelectedItem;
  departments: any[];
  onReload: () => Promise<void>;
  onSelect: (item: SelectedItem) => void;
}) {
  const item = findSelected(plan, selected);
  const parent = findParent(plan, selected);
  if (!item)
    return (
      <EmptyState
        title="Select an item"
        description="Choose a section from the outline to edit it."
      />
    );

  if (selected.type === "plan")
    return <PlanMetadataEditor plan={plan} onReload={onReload} />;
  if (selected.type === "goal")
    return (
      <GoalEditor
        goal={item}
        planId={plan.id}
        onReload={onReload}
        onSelect={onSelect}
      />
    );
  if (selected.type === "objective")
    return (
      <ObjectiveEditor
        objective={item}
        goal={parent.goal}
        onReload={onReload}
        onSelect={onSelect}
      />
    );
  return (
    <ProgramEditor
      program={item}
      objective={parent.objective}
      planId={plan.id}
      ownerDepartmentId={plan.department_id}
      departments={departments}
      onReload={onReload}
    />
  );
}

function PlanMetadataEditor({
  plan,
  onReload,
}: {
  plan: any;
  onReload: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: plan.name ?? "",
    description: plan.description ?? "",
    vision: plan.vision ?? "",
    mission: plan.mission ?? "",
    startYear: plan.start_year,
  });

  const save = async () => {
    try {
      await jsonFetch(`/api/strategic-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      await onReload();
      toast({ title: "Plan metadata saved" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>Plan metadata</CardTitle>
        <CardDescription>
          Edit the strategic narrative and fixed 5-year horizon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-[1fr_160px] gap-4">
          <div>
            <Label>Plan name</Label>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div>
            <Label>Start year</Label>
            <Input
              type="number"
              value={form.startYear}
              onChange={(event) =>
                setForm({ ...form, startYear: Number(event.target.value) })
              }
            />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Vision</Label>
            <Textarea
              className="min-h-48"
              value={form.vision}
              onChange={(event) =>
                setForm({ ...form, vision: event.target.value })
              }
            />
          </div>
          <div>
            <Label>Mission</Label>
            <Textarea
              className="min-h-48"
              value={form.mission}
              onChange={(event) =>
                setForm({ ...form, mission: event.target.value })
              }
            />
          </div>
        </div>
        <Button onClick={save}>Save metadata</Button>
      </CardContent>
    </Card>
  );
}

function GoalEditor({
  goal,
  planId,
  onReload,
  onSelect,
}: {
  goal: any;
  planId: string;
  onReload: () => Promise<void>;
  onSelect: (item: SelectedItem) => void;
}) {
  const [form, setForm] = useState({
    title: goal.title ?? "",
    description: goal.description ?? "",
  });
  const [objectiveTitle, setObjectiveTitle] = useState("");

  const save = async () => {
    await guardedMutation(
      `/api/strategic-goals/${goal.id}`,
      { title: form.title, description: form.description },
      "PATCH",
      onReload,
      "Goal saved",
    );
  };
  const addObjective = async () => {
    try {
      const objective = await jsonFetch<any>(
        `/api/strategic-goals/${goal.id}/objectives`,
        { method: "POST", body: JSON.stringify({ title: objectiveTitle }) },
      );
      setObjectiveTitle("");
      await onReload();
      onSelect({ type: "objective", id: objective.id });
    } catch (error) {
      toast({
        title: "Add objective failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>Goal {goal.number}</CardTitle>
        <CardDescription>
          Define the broad strategic outcome, then add objectives beneath it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Goal title</Label>
          <Input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>
        <Button onClick={save}>Save goal</Button>
        <div className="border-t pt-4 space-y-2">
          <Label>Add objective to this goal</Label>
          <div className="flex gap-2">
            <Input
              value={objectiveTitle}
              onChange={(event) => setObjectiveTitle(event.target.value)}
              placeholder="Objective title"
            />
            <Button variant="outline" onClick={addObjective}>
              <Plus className="h-4 w-4 mr-2" />
              Add objective
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ObjectiveEditor({
  objective,
  goal,
  onReload,
  onSelect,
}: {
  objective: any;
  goal: any;
  onReload: () => Promise<void>;
  onSelect: (item: SelectedItem) => void;
}) {
  const [title, setTitle] = useState(objective.title ?? "");
  const [programTitle, setProgramTitle] = useState("");

  const save = async () =>
    guardedMutation(
      `/api/strategic-objectives/${objective.id}`,
      { title },
      "PATCH",
      onReload,
      "Objective saved",
    );
  const addProgram = async () => {
    try {
      const program = await jsonFetch<any>(
        `/api/strategic-objectives/${objective.id}/programs`,
        { method: "POST", body: JSON.stringify({ title: programTitle }) },
      );
      setProgramTitle("");
      await onReload();
      onSelect({ type: "program", id: program.id });
    } catch (error) {
      toast({
        title: "Add program failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>Objective {objective.number}</CardTitle>
        <CardDescription>
          Under Goal {goal?.number}: {goal?.title}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Objective title</Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <Button onClick={save}>Save objective</Button>
        <div className="border-t pt-4 space-y-2">
          <Label>Add program to this objective</Label>
          <div className="flex gap-2">
            <Input
              value={programTitle}
              onChange={(event) => setProgramTitle(event.target.value)}
              placeholder="Program title"
            />
            <Button variant="outline" onClick={addProgram}>
              <Plus className="h-4 w-4 mr-2" />
              Add program
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgramEditor({
  program,
  objective,
  planId,
  ownerDepartmentId,
  departments,
  onReload,
}: {
  program: any;
  objective: any;
  planId: string;
  ownerDepartmentId: string;
  departments: any[];
  onReload: () => Promise<void>;
}) {
  const [overview, setOverview] = useState({
    title: program.title ?? "",
    description: program.description ?? "",
    status: program.status ?? "not_started",
  });
  const [checklistText, setChecklistText] = useState("");
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      (program.targets ?? []).map((target: any) => [
        target.period_id,
        { ...target },
      ]),
    ),
  );
  const [collaboratorDepartmentIds, setCollaboratorDepartmentIds] = useState<
    string[]
  >(() =>
    (program.collaborators ?? []).map((collab: any) => collab.department_id),
  );
  const [budgetDrafts, setBudgetDrafts] = useState<any[]>(() =>
    (program.budget ?? []).map((line: any) => ({ ...line })),
  );
  const [newBudgetLine, setNewBudgetLine] = useState({
    period_id: program.targets?.[0]?.period_id ?? "",
    label: "",
    description: "",
    amount_idr: "",
  });

  useEffect(() => {
    setOverview({
      title: program.title ?? "",
      description: program.description ?? "",
      status: program.status ?? "not_started",
    });
    setTargetDrafts(
      Object.fromEntries(
        (program.targets ?? []).map((target: any) => [
          target.period_id,
          { ...target },
        ]),
      ),
    );
    setCollaboratorDepartmentIds(
      (program.collaborators ?? []).map((collab: any) => collab.department_id),
    );
    setBudgetDrafts((program.budget ?? []).map((line: any) => ({ ...line })));
    setNewBudgetLine({
      period_id: program.targets?.[0]?.period_id ?? "",
      label: "",
      description: "",
      amount_idr: "",
    });
  }, [program.id]);

  const availableCollaboratorDepartments = departments.filter(
    (department) => department.id !== ownerDepartmentId,
  );

  const saveOverview = async () =>
    guardedMutation(
      `/api/strategic-programs/${program.id}`,
      { title: overview.title, description: overview.description },
      "PATCH",
      onReload,
      "Program saved",
    );
  const saveChecklist = async () => {
    const items = [
      ...(program.checklist ?? []),
      ...(checklistText.trim()
        ? [{ text: checklistText.trim(), done: false }]
        : []),
    ];
    await guardedMutation(
      `/api/strategic-programs/${program.id}/checklist`,
      { items },
      "PUT",
      onReload,
      "Checklist saved",
    );
    setChecklistText("");
  };
  const saveKpis = async () => {
    const links = [
      ...(program.kpi_links ?? []).map((link: any) => link.kpi_id),
      ...selectedKpiIds,
    ];
    await guardedMutation(
      `/api/strategic-programs/${program.id}/kpi-links`,
      { links },
      "PUT",
      onReload,
      "KPI links saved",
    );
    setSelectedKpiIds([]);
  };
  const saveTargets = async () => {
    await guardedMutation(
      `/api/strategic-programs/${program.id}/targets`,
      { targets: Object.values(targetDrafts) },
      "PUT",
      onReload,
      "Targets saved",
    );
  };
  const saveCollaborators = async () => {
    await guardedMutation(
      `/api/strategic-programs/${program.id}/collaborators`,
      { departmentIds: collaboratorDepartmentIds },
      "PUT",
      onReload,
      "Collaborators saved",
    );
  };
  const addBudgetLine = () => {
    if (!newBudgetLine.label.trim() || !newBudgetLine.period_id) return;
    setBudgetDrafts([
      ...budgetDrafts,
      {
        ...newBudgetLine,
        label: newBudgetLine.label.trim(),
        amount_idr: Number(newBudgetLine.amount_idr || 0),
      },
    ]);
    setNewBudgetLine({
      period_id: program.targets?.[0]?.period_id ?? "",
      label: "",
      description: "",
      amount_idr: "",
    });
  };
  const saveBudget = async () => {
    await guardedMutation(
      `/api/strategic-programs/${program.id}/budget`,
      { lines: budgetDrafts },
      "PUT",
      onReload,
      "Budget saved",
    );
  };

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div>
            <CardTitle>
              {program.code}: {program.title}
            </CardTitle>
            <CardDescription>
              Under Objective {objective?.number}: {objective?.title}
            </CardDescription>
          </div>
          <StatusBadge status={program.status} />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="kpis">KPI Coverage</TabsTrigger>
            <TabsTrigger value="targets">Targets</TabsTrigger>
            <TabsTrigger value="collab">Collaborators</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div>
              <Label>Program title</Label>
              <Input
                value={overview.title}
                onChange={(event) =>
                  setOverview({ ...overview, title: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={overview.description}
                onChange={(event) =>
                  setOverview({ ...overview, description: event.target.value })
                }
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Program progress starts as <b>Not started</b>. Use the
              <b> Update Progress</b> panel on the plan overview to change the
              execution status with a dated note.
            </div>
            <Button onClick={saveOverview}>Save program</Button>
          </TabsContent>

          <TabsContent value="checklist" className="space-y-3">
            {(program.checklist ?? []).map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border p-3"
              >
                <CheckCircle2
                  className={
                    item.done
                      ? "h-4 w-4 text-green-500"
                      : "h-4 w-4 text-muted-foreground"
                  }
                />
                {item.text}
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={checklistText}
                onChange={(event) => setChecklistText(event.target.value)}
                placeholder="Add checklist item"
              />
              <Button onClick={saveChecklist}>Save checklist</Button>
            </div>
          </TabsContent>

          <TabsContent value="kpis" className="space-y-3">
            <KpiCoveragePicker
              planId={planId}
              linkedKpis={program.kpi_links ?? []}
              selectedKpiIds={selectedKpiIds}
              onSelectedKpiIdsChange={setSelectedKpiIds}
              onSave={saveKpis}
            />
          </TabsContent>

          <TabsContent value="targets" className="space-y-3">
            {(program.targets ?? []).map((target: any) => {
              const draft = targetDrafts[target.period_id] ?? target;
              return (
                <div
                  key={target.id}
                  className="rounded-xl border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <b>{target.period_label}</b>
                    <StatusBadge status={draft.status} />
                  </div>
                  <div>
                    <Label>Target</Label>
                    <Textarea
                      value={draft.target_text ?? ""}
                      onChange={(event) =>
                        setTargetDrafts({
                          ...targetDrafts,
                          [target.period_id]: {
                            ...draft,
                            period_id: target.period_id,
                            target_text: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Actual</Label>
                    <Textarea
                      value={draft.actual_text ?? ""}
                      onChange={(event) =>
                        setTargetDrafts({
                          ...targetDrafts,
                          [target.period_id]: {
                            ...draft,
                            period_id: target.period_id,
                            actual_text: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="max-w-xs">
                    <Label>Status</Label>
                    <Select
                      value={draft.status ?? "not_started"}
                      onValueChange={(status) =>
                        setTargetDrafts({
                          ...targetDrafts,
                          [target.period_id]: {
                            ...draft,
                            period_id: target.period_id,
                            status,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {programStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabel[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {target.evidence_key && (
                    <p className="text-xs text-muted-foreground">
                      Evidence: {target.evidence_key}
                    </p>
                  )}
                </div>
              );
            })}
            <Button onClick={saveTargets}>Save targets</Button>
          </TabsContent>

          <TabsContent value="collab" className="space-y-4">
            <div className="space-y-2">
              <Label>Collaborating departments</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {availableCollaboratorDepartments.map((department) => (
                  <label
                    key={department.id}
                    className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={collaboratorDepartmentIds.includes(
                        department.id,
                      )}
                      onChange={(event) => {
                        setCollaboratorDepartmentIds(
                          event.target.checked
                            ? [...collaboratorDepartmentIds, department.id]
                            : collaboratorDepartmentIds.filter(
                                (id) => id !== department.id,
                              ),
                        );
                      }}
                    />
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {department.name}
                  </label>
                ))}
              </div>
              {availableCollaboratorDepartments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No other departments are available to select.
                </p>
              )}
            </div>
            <Button onClick={saveCollaborators}>Save collaborators</Button>
          </TabsContent>

          <TabsContent value="budget">
            <BudgetEditor
              lines={budgetDrafts}
              periods={program.targets ?? []}
              newLine={newBudgetLine}
              onNewLineChange={setNewBudgetLine}
              onAddLine={addBudgetLine}
              onLinesChange={setBudgetDrafts}
              onSave={saveBudget}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function KpiCoveragePicker({
  planId,
  linkedKpis,
  selectedKpiIds,
  onSelectedKpiIdsChange,
  onSave,
}: {
  planId: string;
  linkedKpis: any[];
  selectedKpiIds: string[];
  onSelectedKpiIdsChange: (ids: string[]) => void;
  onSave: () => void;
}) {
  const [search, setSearch] = useState("");
  const [dropdownKpiId, setDropdownKpiId] = useState("");
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const linkedIds = new Set(linkedKpis.map((link: any) => link.kpi_id));
  const selectedIds = new Set(selectedKpiIds);

  useEffect(() => {
    const controller = new AbortController();
    const loadOptions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        const suffix = params.toString() ? `?${params.toString()}` : "";
        const data = await jsonFetch<any[]>(
          `/api/strategic-plans/${planId}/kpis${suffix}`,
          { signal: controller.signal },
        );
        setOptions(data);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast({
            title: "KPI options failed",
            description: (error as Error).message,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    };
    const timeout = window.setTimeout(loadOptions, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [planId, search]);

  const toggle = (id: string) => {
    if (linkedIds.has(id)) return;
    if (selectedIds.has(id))
      onSelectedKpiIdsChange(selectedKpiIds.filter((item) => item !== id));
    else onSelectedKpiIdsChange([...selectedKpiIds, id]);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Currently linked KPIs</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {linkedKpis.map((link: any) => (
            <Badge
              key={link.id}
              variant="outline"
              className="max-w-full whitespace-normal text-left"
            >
              <span className="font-semibold">
                {link.code || link.coverage_label}
              </span>
              {link.kpi_name && (
                <span className="ml-1 text-muted-foreground">
                  — {link.kpi_name}
                </span>
              )}
            </Badge>
          ))}
          {linkedKpis.length === 0 && (
            <span className="text-sm text-muted-foreground">
              No KPIs linked yet.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <div>
          <Label>Choose from this department’s KPI template</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Search by KPI code like D1.S2.K1 or by KPI text. Options are
            restricted to this plan department plus global templates.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search department KPIs…"
            />
          </div>
          <Select
            value={dropdownKpiId}
            onValueChange={(value) => {
              toggle(value);
              setDropdownKpiId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select KPI from dropdown" />
            </SelectTrigger>
            <SelectContent>
              {options
                .filter((option) => !linkedIds.has(option.id))
                .map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.code} — {option.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border bg-background/60 divide-y">
          {loading && (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading KPI options…
            </div>
          )}
          {!loading &&
            options.map((option) => {
              const disabled = linkedIds.has(option.id);
              const checked = selectedIds.has(option.id) || disabled;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={`w-full text-left p-3 flex gap-3 transition ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/70"}`}
                >
                  <div
                    className={`mt-1 h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "bg-background"}`}
                  >
                    {checked && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{option.code}</Badge>
                      {disabled && (
                        <Badge variant="outline">Already linked</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {option.template_name}
                      </span>
                    </div>
                    <p className="font-medium mt-1">{option.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {option.standard_name}
                    </p>
                  </div>
                </button>
              );
            })}
          {!loading && options.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No KPI options found for this department/template.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedKpiIds.length} new KPI
            {selectedKpiIds.length === 1 ? "" : "s"} selected
          </p>
          <Button onClick={onSave} disabled={selectedKpiIds.length === 0}>
            Save KPI links
          </Button>
        </div>
      </div>
    </div>
  );
}

async function guardedMutation(
  url: string,
  body: unknown,
  method: string,
  onReload: () => Promise<void>,
  successTitle: string,
) {
  try {
    await jsonFetch(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    await onReload();
    toast({ title: successTitle });
  } catch (error) {
    toast({
      title: "Update failed",
      description: (error as Error).message,
      variant: "destructive",
    });
  }
}

function PlanHealth({ plan, stats }: { plan: any; stats: any }) {
  const readiness = [
    stats.goals > 0,
    stats.objectives > 0,
    stats.programs > 0,
    stats.missingKpis === 0,
    stats.missingTargets === 0,
  ];
  const score = Math.round(
    (readiness.filter(Boolean).length / readiness.length) * 100,
  );
  return (
    <Card className="glass-panel border-border/30 sticky top-24">
      <CardHeader>
        <CardTitle>Plan health</CardTitle>
        <CardDescription>Readiness before publishing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold">{score}%</div>
        <div className="space-y-2 text-sm">
          <HealthRow ok={stats.goals > 0} label={`${stats.goals} goals`} />
          <HealthRow
            ok={stats.objectives > 0}
            label={`${stats.objectives} objectives`}
          />
          <HealthRow
            ok={stats.programs > 0}
            label={`${stats.programs} programs`}
          />
          <HealthRow
            ok={stats.missingKpis === 0}
            label={`${stats.missingKpis} programs missing KPI links`}
          />
          <HealthRow
            ok={stats.missingTargets === 0}
            label={`${stats.missingTargets} programs with blank targets`}
          />
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <b>Budget total</b>
          <br />
          IDR {stats.totalBudget.toLocaleString("id-ID")}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      )}
      <span>{label}</span>
    </div>
  );
}

function ProgramProgressPanel({
  programs,
  onReload,
}: {
  programs: any[];
  onReload: () => Promise<void>;
}) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const selectedProgram = programs.find(
    (program: any) => program.id === programId,
  );
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("not_started");
  const [checklistDrafts, setChecklistDrafts] = useState<any[]>(() =>
    (selectedProgram?.checklist ?? []).map((item: any) => ({ ...item })),
  );

  useEffect(() => {
    if (!programs.length) return;
    const nextProgram =
      programs.find((program: any) => program.id === programId) ?? programs[0];
    setProgramId(nextProgram.id);
    setStatus(nextProgram.status ?? "not_started");
  }, [programs.length, programId]);

  useEffect(() => {
    setChecklistDrafts(
      (selectedProgram?.checklist ?? []).map((item: any) => ({ ...item })),
    );
  }, [selectedProgram?.id]);

  const saveChecklistProgress = async () => {
    if (!selectedProgram) return;
    await guardedMutation(
      `/api/strategic-programs/${selectedProgram.id}/checklist`,
      { items: checklistDrafts },
      "PUT",
      onReload,
      "Checklist progress saved",
    );
  };

  const postUpdate = async () => {
    if (!selectedProgram || !note.trim()) return;
    await guardedMutation(
      `/api/strategic-programs/${selectedProgram.id}/updates`,
      { note, status },
      "POST",
      onReload,
      "Progress update posted",
    );
    setNote("");
  };

  if (programs.length === 0) return null;

  return (
    <Card
      id="program-progress-updates"
      className="glass-panel border-border/30 scroll-mt-24"
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <CardTitle>Update Progress</CardTitle>
            <CardDescription>
              Record execution progress here. New programs stay Not started
              until an update is posted.
            </CardDescription>
          </div>
          {selectedProgram && <StatusBadge status={selectedProgram.status} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-[1fr_220px] gap-3">
          <div>
            <Label>Program</Label>
            <Select
              value={programId}
              onValueChange={(value) => {
                const nextProgram = programs.find(
                  (program: any) => program.id === value,
                );
                setProgramId(value);
                setStatus(nextProgram?.status ?? "not_started");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program: any) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.code}: {program.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>New status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {programStatuses.map((programStatus) => (
                  <SelectItem key={programStatus} value={programStatus}>
                    {statusLabel[programStatus]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Progress note</Label>
          <Textarea
            className="min-h-28"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What changed since the last update?"
          />
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Checklist progress</h3>
            <p className="text-sm text-muted-foreground">
              Optional. Mark existing checklist items as done here. Add, remove,
              or edit checklist items from the builder.
            </p>
          </div>
          <div className="space-y-2">
            {checklistDrafts.map((item, index) => (
              <label
                key={item.id ?? index}
                className="flex items-start gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(item.done)}
                  onChange={(event) =>
                    setChecklistDrafts(
                      checklistDrafts.map((draft, draftIndex) =>
                        draftIndex === index
                          ? { ...draft, done: event.target.checked }
                          : draft,
                      ),
                    )
                  }
                />
                <span
                  className={
                    item.done ? "line-through text-muted-foreground" : ""
                  }
                >
                  {item.text}
                </span>
              </label>
            ))}
            {checklistDrafts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No checklist items have been created for this program yet.
              </p>
            )}
          </div>
          {checklistDrafts.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={saveChecklistProgress}
            >
              Save checklist progress
            </Button>
          )}
        </div>

        <Button
          onClick={postUpdate}
          disabled={!selectedProgram || !note.trim()}
        >
          Post update
        </Button>

        <div className="space-y-3 pt-2">
          <h3 className="font-semibold">Recent updates</h3>
          {(selectedProgram?.updates ?? []).map((item: any) => (
            <div key={item.id} className="rounded-lg border p-3">
              <StatusBadge status={item.status} />
              <p className="mt-2 whitespace-pre-wrap">{item.note}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.author_name || "Unknown"} ·{" "}
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {(selectedProgram?.updates ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No progress updates yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadOnlyStructure({ plan }: { plan: any }) {
  const goals = plan.goals ?? [];

  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>Plan structure</CardTitle>
        <CardDescription>
          A clean read-only structure. Open the builder to edit one item at a
          time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {goals.map((goal: any) => (
          <div key={goal.id} className="rounded-xl border p-4">
            <h3 className="text-xl font-bold">
              Goal {goal.number}: {goal.title}
            </h3>
            <p className="text-muted-foreground mt-1">{goal.description}</p>
            <div className="mt-4 space-y-3">
              {(goal.objectives ?? []).map((objective: any) => (
                <div key={objective.id} className="rounded-lg bg-muted/30 p-3">
                  <h4 className="font-semibold">
                    Objective {objective.number}: {objective.title}
                  </h4>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {(objective.programs ?? []).map((program: any) => (
                      <div
                        key={program.id}
                        className="rounded-lg border bg-background/60 p-3"
                      >
                        <div className="flex justify-between gap-2">
                          <b>
                            {program.code}: {program.title}
                          </b>
                          <StatusBadge status={program.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {goals.length === 0 && (
          <EmptyState
            title="No structure yet"
            description="Open the builder and add the first goal."
          />
        )}
      </CardContent>
    </Card>
  );
}

function ProgramDirectory({ plan }: { plan: any }) {
  const [search, setSearch] = useState("");
  const programs = flattenPrograms(plan).filter((program: any) =>
    `${program.title} ${program.code} ${program.goal.title} ${program.objective.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>Program directory</CardTitle>
        <CardDescription>
          Search initiatives without navigating the full hierarchy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search programs, goals, objectives…"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {programs.map((program: any) => (
            <Link
              href={`/strategic-plans/${plan.id}/edit?programId=${program.id}`}
              key={program.id}
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <b>
                      {program.code}: {program.title}
                    </b>
                    <StatusBadge status={program.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Goal {program.goal.number} → Objective{" "}
                    {program.objective.number}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {(program.kpi_links ?? []).length} KPIs
                    </Badge>
                    <Badge variant="outline">
                      {(program.budget ?? []).length} budget lines
                    </Badge>
                    <Badge variant="outline">
                      {(program.updates ?? []).length} updates
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {programs.length === 0 && (
          <EmptyState
            icon={Search}
            title="No programs found"
            description="Try a different search or add programs in the builder."
          />
        )}
      </CardContent>
    </Card>
  );
}

function TargetsMatrix({ plan }: { plan: any }) {
  const programs = flattenPrograms(plan);
  return (
    <Card className="glass-panel border-border/30">
      <CardHeader>
        <CardTitle>Targets matrix</CardTitle>
        <CardDescription>
          Programs across the fixed 5-year plan horizon.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Program</th>
              {(plan.periods ?? []).map((period: any) => (
                <th key={period.id} className="p-3 text-left">
                  {period.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map((program: any) => (
              <tr key={program.id} className="border-b align-top">
                <td className="p-3 font-medium">
                  {program.code}: {program.title}
                </td>
                {(plan.periods ?? []).map((period: any) => {
                  const target = (program.targets ?? []).find(
                    (item: any) => item.period_id === period.id,
                  );
                  return (
                    <td key={period.id} className="p-3">
                      <StatusBadge status={target?.status ?? "not_started"} />
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                        {target?.target_text || "No target"}
                      </p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function BudgetEditor({
  lines,
  periods,
  newLine,
  onNewLineChange,
  onAddLine,
  onLinesChange,
  onSave,
}: {
  lines: any[];
  periods: any[];
  newLine: any;
  onNewLineChange: (line: any) => void;
  onAddLine: () => void;
  onLinesChange: (lines: any[]) => void;
  onSave: () => void;
}) {
  const total = lines.reduce(
    (sum, line) => sum + Number(line.amount_idr ?? 0),
    0,
  );
  const periodLabel = (periodId: string) =>
    periods.find((period: any) => period.period_id === periodId)
      ?.period_label ?? "Select period";

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/30 p-3 font-semibold">
        Total: IDR {total.toLocaleString("id-ID")}
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="grid md:grid-cols-[160px_1fr_180px] gap-3">
          <div>
            <Label>Period</Label>
            <Select
              value={newLine.period_id}
              onValueChange={(period_id) =>
                onNewLineChange({ ...newLine, period_id })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period: any) => (
                  <SelectItem key={period.period_id} value={period.period_id}>
                    {period.period_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Budget item</Label>
            <Input
              value={newLine.label}
              onChange={(event) =>
                onNewLineChange({ ...newLine, label: event.target.value })
              }
              placeholder="e.g. Workshop, software license, consultant"
            />
          </div>
          <div>
            <Label>Amount (IDR)</Label>
            <Input
              type="number"
              min="0"
              value={newLine.amount_idr}
              onChange={(event) =>
                onNewLineChange({ ...newLine, amount_idr: event.target.value })
              }
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={newLine.description}
            onChange={(event) =>
              onNewLineChange({ ...newLine, description: event.target.value })
            }
            placeholder="Optional budget notes"
          />
        </div>
        <Button type="button" variant="outline" onClick={onAddLine}>
          <Plus className="h-4 w-4 mr-2" />
          Add budget line
        </Button>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div
            key={line.id ?? `${line.period_id}-${index}`}
            className="rounded-lg border p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>
                  {periodLabel(line.period_id)}: {line.label}
                </b>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {line.description}
                </p>
                <p>
                  IDR {Number(line.amount_idr ?? 0).toLocaleString("id-ID")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onLinesChange(
                    lines.filter((_, lineIndex) => lineIndex !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No budget lines yet. Fill the fields above, add a line, then save.
          </p>
        )}
      </div>

      <Button onClick={onSave}>Save budget</Button>
    </div>
  );
}

function BudgetLines({ lines }: { lines: any[] }) {
  const total = lines.reduce(
    (sum, line) => sum + Number(line.amount_idr ?? 0),
    0,
  );
  return (
    <div className="space-y-2">
      <div className="font-semibold">
        Total: IDR {total.toLocaleString("id-ID")}
      </div>
      {lines.map((line) => (
        <div key={line.id} className="rounded-lg border p-3 text-sm">
          <b>
            {line.period_label}: {line.label}
          </b>
          <p>{line.description}</p>
          <p>IDR {Number(line.amount_idr).toLocaleString("id-ID")}</p>
        </div>
      ))}
      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">No budget lines yet.</p>
      )}
    </div>
  );
}

function BudgetView({ plan }: { plan: any }) {
  const lines = flattenPrograms(plan).flatMap((program: any) =>
    (program.budget ?? []).map((line: any) => ({
      ...line,
      program: program.title,
      goal: program.goal.title,
    })),
  );
  const total = lines.reduce(
    (sum: number, line: any) => sum + Number(line.amount_idr ?? 0),
    0,
  );
  const periodTotals = (plan.periods ?? []).map((period: any) => ({
    period,
    total: lines
      .filter((line: any) => line.period_id === period.id)
      .reduce(
        (sum: number, line: any) => sum + Number(line.amount_idr ?? 0),
        0,
      ),
  }));
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/strategic-plans/${plan.id}`}
          className="text-sm text-primary"
        >
          ← Back to overview
        </Link>
        <h1 className="text-4xl font-bold mt-2">Budget — {plan.name}</h1>
        <p className="text-muted-foreground">
          Plan total: IDR {total.toLocaleString("id-ID")}
        </p>
      </div>
      <div className="grid md:grid-cols-5 gap-3">
        {periodTotals.map(({ period, total }: any) => (
          <Card key={period.id} className="glass-panel">
            <CardContent className="p-4">
              <div className="font-bold">{period.label}</div>
              <div className="text-sm text-muted-foreground">
                IDR {total.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="glass-panel">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-left">Goal</th>
                <th className="p-3 text-left">Program</th>
                <th className="p-3 text-left">Label</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => (
                <tr key={line.id} className="border-b">
                  <td className="p-3">{line.period_label}</td>
                  <td className="p-3">{line.goal}</td>
                  <td className="p-3">{line.program}</td>
                  <td className="p-3">{line.label}</td>
                  <td className="p-3 text-right">
                    IDR {Number(line.amount_idr).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {lines.length === 0 && (
        <EmptyState
          icon={DollarSign}
          title="No budget lines"
          description="Budget APIs are available; add budget lines from the program budget workflow."
        />
      )}
    </div>
  );
}

function PrintView({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<any | null>(null);
  useEffect(() => {
    void jsonFetch<any>(`/api/strategic-plans/${planId}`).then(setPlan);
  }, [planId]);
  if (!plan)
    return (
      <Shell print>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Shell>
    );
  return (
    <Shell print>
      <style>
        {"@media print{@page{size:A4;margin:16mm}.no-print{display:none}}"}
      </style>
      <Button className="no-print mb-6" onClick={() => window.print()}>
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>
      <h1 className="text-3xl font-bold">{plan.name}</h1>
      <p>
        {plan.department_name} · {plan.start_year}–{plan.end_year}
      </p>
      <hr className="my-4" />
      <h2 className="font-bold">Vision</h2>
      <p>{plan.vision}</p>
      <h2 className="font-bold mt-4">Mission</h2>
      <p>{plan.mission}</p>
      {(plan.goals ?? []).map((goal: any) => (
        <section key={goal.id} className="mt-8 break-inside-avoid">
          <h2 className="text-2xl font-bold">
            Goal {goal.number}: {goal.title}
          </h2>
          <p>{goal.description}</p>
          {(goal.objectives ?? []).map((objective: any) => (
            <div key={objective.id} className="mt-4">
              <h3 className="text-xl font-semibold">
                Objective {objective.number}: {objective.title}
              </h3>
              {(objective.programs ?? []).map((program: any) => (
                <div
                  key={program.id}
                  className="mt-3 border p-3 break-inside-avoid"
                >
                  <h4 className="font-bold">
                    {program.code}: {program.title} (
                    {statusLabel[program.status]})
                  </h4>
                  <p>{program.description}</p>
                  <ul className="list-disc ml-5">
                    {(program.checklist ?? []).map((item: any) => (
                      <li key={item.id}>
                        {item.done ? "☑" : "☐"} {item.text}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    <b>KPI:</b>{" "}
                    {(program.kpi_links ?? [])
                      .map((link: any) =>
                        link.kpi_name
                          ? `${link.code} — ${link.kpi_name}`
                          : link.code,
                      )
                      .join(", ") || "—"}
                  </p>
                  <p>
                    <b>Collaborators:</b>{" "}
                    {(program.collaborators ?? [])
                      .map((collab: any) => collab.department_name)
                      .join(", ") || "—"}
                  </p>
                  <BudgetLines lines={program.budget ?? []} />
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </Shell>
  );
}

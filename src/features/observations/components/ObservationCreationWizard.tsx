"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  FileText,
  Loader2,
  School,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createObservation,
  fetchObservationCreationForms,
  fetchObservationCreationStaff,
} from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import type {
  ObservationCreationForm,
  ObservationCreationStaff,
  ObservationManagerOption,
} from "../types";

const steps = ["Select staff", "Select form", "Details", "Review"] as const;
type ScopeType = "INDIVIDUAL" | "CLASS" | "SUBJECT";

function personName(person: { email: string; fullName: string | null }): string {
  return person.fullName?.trim() || person.email;
}

function participantLabel(staff: ObservationCreationStaff[]): string {
  if (staff.length === 1) return personName(staff[0]);
  return `${staff.length} staff members`;
}

function localDateValue(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function displayDate(value: string): string {
  if (!value) return "Not set";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ObservationCreationWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? "";
  const isAdmin = roles.includes("admin");
  const canCreate = isAdmin || roles.includes("manager");

  const [step, setStep] = useState(0);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [formKey, setFormKey] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [observationDate, setObservationDate] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("INDIVIDUAL");
  const [className, setClassName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [formSearch, setFormSearch] = useState("");
  const [validationError, setValidationError] = useState("");
  const [completed, setCompleted] = useState(false);

  const sortedStaffIds = useMemo(() => [...staffIds].sort(), [staffIds]);
  const staffQuery = useQuery({
    queryKey: observationKeys.creationStaff(),
    queryFn: fetchObservationCreationStaff,
    enabled: canCreate,
  });
  const formsQuery = useQuery({
    queryKey: observationKeys.creationFormsFor(sortedStaffIds),
    queryFn: () => fetchObservationCreationForms(sortedStaffIds),
    enabled: canCreate && sortedStaffIds.length > 0,
  });

  const selectedStaff = useMemo(() => {
    const selected = new Set(staffIds);
    return (staffQuery.data ?? []).filter((staff) => selected.has(staff.id));
  }, [staffIds, staffQuery.data]);
  const selectedForm = formsQuery.data?.find(
    (form) => `${form.id}:${form.workflowId}` === formKey,
  ) ?? null;
  const observer = currentUserId
    ? {
        id: currentUserId,
        email: session?.user?.email ?? "",
        fullName: session?.user?.name ?? null,
      }
    : null;

  const meaningfulInput = Boolean(
    staffIds.length || formKey || title || description || observationDate || dueAt || className || subjectName,
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!completed && meaningfulInput) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [completed, meaningfulInput]);

  const filteredForms = useMemo(() => {
    const search = formSearch.trim().toLowerCase();
    if (!search) return formsQuery.data ?? [];
    return (formsQuery.data ?? []).filter((form) =>
      [form.name, form.description, form.workflowName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    );
  }, [formSearch, formsQuery.data]);

  const create = useMutation({
    mutationFn: createObservation,
    onSuccess: async (response) => {
      setCompleted(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.creationForms() }),
      ]);
      toast.success(
        selectedStaff.length === 1
          ? "Observation draft created."
          : `Observation draft created for ${selectedStaff.length} staff members.`,
      );
      router.push(`/observations/${response.observation.id}/edit`);
    },
    onError: (error) => toast.error(error.message),
  });

  function toggleStaff(id: string) {
    setStaffIds((current) => {
      if (current.includes(id)) return current.filter((staffId) => staffId !== id);
      if (current.length >= 20) {
        toast.error("You can select up to 20 staff members.");
        return current;
      }
      const next = [...current, id];
      if (next.length > 1 && scopeType === "INDIVIDUAL") setScopeType("CLASS");
      return next;
    });
    setFormKey("");
    setFormSearch("");
    if (!titleTouched) setTitle("");
    setValidationError("");
  }

  function chooseForm(form: ObservationCreationForm) {
    setFormKey(`${form.id}:${form.workflowId}`);
    if (!titleTouched) {
      setTitle(`${form.name} — ${participantLabel(selectedStaff)}`);
    }
    setValidationError("");
  }

  function validateCurrentStep(): boolean {
    let message = "";
    if (step === 0 && selectedStaff.length === 0) message = "Select at least one staff member to continue.";
    if (step === 1 && !selectedForm) message = "Select a common observation form to continue.";
    if (step === 2) {
      if (!dueAt) message = "Due date is required.";
      else if (dueAt < localDateValue()) message = "Due date cannot be in the past.";
      else if (observationDate && dueAt < observationDate) {
        message = "Due date cannot precede the observation date.";
      } else if (selectedStaff.length > 1 && scopeType === "INDIVIDUAL") {
        message = "Choose class or subject scope for a multi-teacher observation.";
      } else if (scopeType === "CLASS" && !className.trim()) {
        message = "Class name is required for class scope.";
      } else if (scopeType === "SUBJECT" && !subjectName.trim()) {
        message = "Subject name is required for subject scope.";
      } else if (!observer) message = "Unable to identify the observer.";
      else if (staffIds.includes(observer.id)) {
        message = "You cannot create an observation for yourself.";
      }
    }
    setValidationError(message);
    return !message;
  }

  function next() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function submit() {
    if (selectedStaff.length === 0 || !selectedForm || !observer || !validateCurrentStep()) return;
    create.mutate({
      staffIds: selectedStaff.map((staff) => staff.id),
      rubricId: selectedForm.id,
      workflowId: selectedForm.workflowId,
      title: title.trim() || `${selectedForm.name} — ${participantLabel(selectedStaff)}`,
      description: description.trim() || undefined,
      observationDate: observationDate
        ? new Date(`${observationDate}T12:00:00`).toISOString()
        : undefined,
      dueAt: new Date(`${dueAt}T23:59:59`).toISOString(),
      scopeType,
      className: className.trim() || undefined,
      subjectName: subjectName.trim() || undefined,
    });
  }

  function cancel() {
    if (!meaningfulInput || window.confirm("Discard this observation draft setup?")) {
      router.push("/observations");
    }
  }

  if (status === "loading") return <WizardLoading />;
  if (!canCreate) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>Only managers and administrators can create observations.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-3 mb-2" onClick={cancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Observation workspace
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">Create observation</h1>
          <p className="mt-2 text-muted-foreground">
            Select up to 20 staff members who share an observation form and workflow.
          </p>
        </div>
        <Badge variant="outline">Step {step + 1} of {steps.length}</Badge>
      </div>

      <StepProgress current={step} />

      {validationError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {step === 0 && (
        <StaffStep
          staff={staffQuery.data ?? []}
          selected={selectedStaff}
          loading={staffQuery.isLoading}
          error={staffQuery.error?.message}
          onToggle={toggleStaff}
        />
      )}
      {step === 1 && (
        <FormStep
          forms={filteredForms}
          selected={selectedForm}
          participantCount={selectedStaff.length}
          loading={formsQuery.isLoading}
          error={formsQuery.error?.message}
          search={formSearch}
          onSearch={setFormSearch}
          onSelect={chooseForm}
          isAdmin={isAdmin}
        />
      )}
      {step === 2 && (
        <DetailsStep
          title={title}
          description={description}
          observationDate={observationDate}
          dueAt={dueAt}
          scopeType={scopeType}
          className={className}
          subjectName={subjectName}
          participantCount={selectedStaff.length}
          onTitleChange={(value) => {
            setTitleTouched(true);
            setTitle(value);
          }}
          onDescriptionChange={setDescription}
          onObservationDateChange={setObservationDate}
          onDueAtChange={setDueAt}
          onScopeTypeChange={setScopeType}
          onClassNameChange={setClassName}
          onSubjectNameChange={setSubjectName}
        />
      )}
      {step === 3 && selectedStaff.length > 0 && selectedForm && observer && (
        <ReviewStep
          staff={selectedStaff}
          form={selectedForm}
          observer={observer}
          title={title.trim() || `${selectedForm.name} — ${participantLabel(selectedStaff)}`}
          description={description}
          observationDate={observationDate}
          dueAt={dueAt}
          scopeType={scopeType}
          className={className}
          subjectName={subjectName}
        />
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={cancel} disabled={create.isPending}>Cancel</Button>
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => { setValidationError(""); setStep(step - 1); }} disabled={create.isPending}>
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={next}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              Create draft
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepProgress({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {steps.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className={cn("rounded-xl border p-3 text-sm", index === current && "border-primary bg-primary/5", index < current && "border-success/40 bg-success/5")}>
          <div className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs", index <= current && "bg-primary text-primary-foreground")}>
              {index < current ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="font-medium">{label}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StaffStep({ staff, selected, loading, error, onToggle }: { staff: ObservationCreationStaff[]; selected: ObservationCreationStaff[]; loading: boolean; error?: string; onToggle: (id: string) => void }) {
  const selectedIds = new Set(selected.map((person) => person.id));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select staff</CardTitle>
        <CardDescription>Choose 1–20 active staff members. The next step will show only forms assigned to everyone selected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <WizardLoading /> : error ? <InlineError message={error} /> : (
          <StaffMultiSelect staff={staff} selectedIds={selectedIds} onToggle={onToggle} />
        )}
        {selected.length > 0 && (
          <div aria-live="polite" className="space-y-2">
            <p className="text-sm font-medium">Selected staff ({selected.length}/20)</p>
            <div className="flex flex-wrap gap-2">
              {selected.map((person) => (
                <Badge key={person.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                  <span>{personName(person)}</span>
                  <button type="button" onClick={() => onToggle(person.id)} className="rounded-sm p-0.5 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remove ${personName(person)}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StaffMultiSelect({ staff, selectedIds, onToggle }: { staff: ObservationCreationStaff[]; selectedIds: Set<string>; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label="Select staff members" aria-expanded={open} className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal">
          <span className={cn("truncate", selectedIds.size === 0 && "text-muted-foreground")}>
            {selectedIds.size ? `${selectedIds.size} staff member${selectedIds.size === 1 ? "" : "s"} selected` : "Search by name, email, department, or role..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput aria-label="Search staff members" placeholder="Search staff..." />
          <CommandList>
            <CommandEmpty>No eligible staff found.</CommandEmpty>
            <CommandGroup>
              {staff.map((person) => {
                const selected = selectedIds.has(person.id);
                const search = [person.fullName, person.email, person.department?.name, ...person.roles].filter(Boolean).join(" ");
                return (
                  <CommandItem key={person.id} value={`${search} ${person.id}`} onSelect={() => onToggle(person.id)} aria-selected={selected} className="gap-3">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border", selected && "border-primary bg-primary text-primary-foreground")} aria-hidden="true">
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0 py-1">
                      <p className="font-medium">{personName(person)}</p>
                      <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {person.department && <Badge variant="outline" className="text-[10px]">{person.department.name}</Badge>}
                        {person.roles.map((role) => <Badge key={role} variant="secondary" className="text-[10px]">{role}</Badge>)}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FormStep({ forms, selected, participantCount, loading, error, search, onSearch, onSelect, isAdmin }: { forms: ObservationCreationForm[]; selected: ObservationCreationForm | null; participantCount: number; loading: boolean; error?: string; search: string; onSearch: (value: string) => void; onSelect: (form: ObservationCreationForm) => void; isAdmin: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select a common observation form</CardTitle>
        <CardDescription>These forms and workflows are assigned to all {participantCount} selected staff member{participantCount === 1 ? "" : "s"}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search forms and workflows" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search forms and workflows..." className="pl-9" />
        </div>
        {loading ? <WizardLoading /> : error ? <InlineError message={error} /> : forms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No common observation form</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin ? "The selected staff do not share an active observation form and workflow assignment. Update assignments or change the selection." : "The selected staff do not share an assigned observation workflow. Change the selection or contact an administrator."}
            </p>
            {isAdmin && <Button asChild variant="outline" className="mt-4"><Link href="/rubrics?tab=observation-form">Manage observation forms</Link></Button>}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {forms.map((form) => {
              const active = selected?.id === form.id && selected.workflowId === form.workflowId;
              return (
                <button key={`${form.id}:${form.workflowId}`} type="button" onClick={() => onSelect(form)} aria-pressed={active} className={cn("rounded-xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "border-primary bg-primary/5")}>
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold">{form.name}</h3><p className="mt-1 text-sm text-muted-foreground">{form.description || "No description provided."}</p></div>
                    {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{form.workflowName}</Badge>
                    <span>{form.sectionCount} sections</span><span>·</span><span>{form.indicatorCount} indicators</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailsStep({ title, description, observationDate, dueAt, scopeType, className, subjectName, participantCount, onTitleChange, onDescriptionChange, onObservationDateChange, onDueAtChange, onScopeTypeChange, onClassNameChange, onSubjectNameChange }: { title: string; description: string; observationDate: string; dueAt: string; scopeType: ScopeType; className: string; subjectName: string; participantCount: number; onTitleChange: (value: string) => void; onDescriptionChange: (value: string) => void; onObservationDateChange: (value: string) => void; onDueAtChange: (value: string) => void; onScopeTypeChange: (value: ScopeType) => void; onClassNameChange: (value: string) => void; onSubjectNameChange: (value: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>Details and context</CardTitle><CardDescription>Add scheduling and teaching context. You will be assigned automatically as the observer.</CardDescription></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2"><Label htmlFor="title">Title <span className="text-muted-foreground">(optional)</span></Label><Input id="title" value={title} onChange={(event) => onTitleChange(event.target.value)} maxLength={200} placeholder="Defaults to form name and selected staff" /><p className="text-xs text-muted-foreground">{title.length}/200</p></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description or purpose <span className="text-muted-foreground">(optional)</span></Label><Textarea id="description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} maxLength={2000} rows={4} placeholder="Add context, focus areas, or the purpose of this observation..." /><p className="text-xs text-muted-foreground">{description.length}/2000</p></div>
        <div className="space-y-2"><Label htmlFor="observation-date">Observation date <span className="text-muted-foreground">(recommended)</span></Label><Input id="observation-date" type="date" value={observationDate} onChange={(event) => onObservationDateChange(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="due-date">Due date</Label><Input id="due-date" type="date" min={localDateValue()} value={dueAt} onChange={(event) => onDueAtChange(event.target.value)} required /></div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="scope-type">Observation scope</Label>
          <select id="scope-type" value={scopeType} onChange={(event) => onScopeTypeChange(event.target.value as ScopeType)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <option value="INDIVIDUAL" disabled={participantCount > 1}>Individual</option>
            <option value="CLASS">Class</option>
            <option value="SUBJECT">Subject</option>
          </select>
          <p className="text-xs text-muted-foreground">Multi-teacher observations require class or subject scope.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="class-name">Class name {scopeType === "CLASS" ? "" : <span className="text-muted-foreground">(optional)</span>}</Label><Input id="class-name" value={className} onChange={(event) => onClassNameChange(event.target.value)} maxLength={200} required={scopeType === "CLASS"} placeholder="e.g. Grade 8A" /></div>
        <div className="space-y-2"><Label htmlFor="subject-name">Subject name {scopeType === "SUBJECT" ? "" : <span className="text-muted-foreground">(optional)</span>}</Label><Input id="subject-name" value={subjectName} onChange={(event) => onSubjectNameChange(event.target.value)} maxLength={200} required={scopeType === "SUBJECT"} placeholder="e.g. Mathematics" /></div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({ staff, form, observer, title, description, observationDate, dueAt, scopeType, className, subjectName }: { staff: ObservationCreationStaff[]; form: ObservationCreationForm; observer: ObservationManagerOption; title: string; description: string; observationDate: string; dueAt: string; scopeType: ScopeType; className: string; subjectName: string }) {
  const scopeDetail = [className.trim(), subjectName.trim()].filter(Boolean).join(" · ") || "No additional context";
  return (
    <Card>
      <CardHeader><CardTitle>Review and create</CardTitle><CardDescription>No server record exists yet. Confirm these details to create one shared draft for {staff.length} participant{staff.length === 1 ? "" : "s"}.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</p><p className="mt-1 text-lg font-semibold">{title}</p>{description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>}</div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observed staff ({staff.length})</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Observed staff">
            {staff.map((person) => <li key={person.id} className="rounded-lg border px-3 py-2"><p className="font-medium">{personName(person)}</p><p className="text-xs text-muted-foreground">{person.email}{person.department?.name ? ` · ${person.department.name}` : ""}</p></li>)}
          </ul>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReviewFact icon={FileText} label="Form" value={form.name} detail={form.workflowName} />
          <ReviewFact icon={UsersRound} label="Observer" value={personName(observer)} detail={observer.email} />
          <ReviewFact icon={scopeType === "SUBJECT" ? BookOpen : School} label="Scope" value={scopeType.charAt(0) + scopeType.slice(1).toLowerCase()} detail={scopeDetail} />
          <ReviewFact icon={CalendarDays} label="Observation date" value={displayDate(observationDate)} />
          <ReviewFact icon={CalendarDays} label="Due date" value={displayDate(dueAt)} />
          <ReviewFact icon={ClipboardCheck} label="Notifications" value="No draft notifications" detail="Participants are notified only after submission" />
        </div>
        <Alert><ClipboardCheck className="h-4 w-4" /><AlertTitle>Shared draft privacy</AlertTitle><AlertDescription>The selected staff members will not be notified and cannot see draft responses until the observer submits the observation.</AlertDescription></Alert>
      </CardContent>
    </Card>
  );
}

function ReviewFact({ icon: Icon, label, value, detail }: { icon: typeof UserRound; label: string; value: string; detail?: string }) { return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="mt-2 font-medium">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>; }
function InlineError({ message }: { message: string }) { return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>; }
function WizardLoading() { return <div className="flex min-h-32 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</div>; }

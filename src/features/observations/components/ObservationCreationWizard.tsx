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
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  FileText,
  Loader2,
  Search,
  UserRound,
  UsersRound,
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

function personName(person: { email: string; fullName: string | null }): string {
  return person.fullName?.trim() || person.email;
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
  const [staffId, setStaffId] = useState("");
  const [formKey, setFormKey] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [observationDate, setObservationDate] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [formSearch, setFormSearch] = useState("");
  const [validationError, setValidationError] = useState("");
  const [completed, setCompleted] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["observations", "creation-staff"],
    queryFn: fetchObservationCreationStaff,
    enabled: canCreate,
  });
  const formsQuery = useQuery({
    queryKey: ["observations", "creation-forms", staffId],
    queryFn: () => fetchObservationCreationForms(staffId),
    enabled: canCreate && Boolean(staffId),
  });

  const selectedStaff = staffQuery.data?.find((staff) => staff.id === staffId) ?? null;
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
    staffId || formKey || title || description || observationDate || dueAt,
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!completed && meaningfulInput) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [completed, meaningfulInput]);

  const filteredForms = useMemo(() => {
    const query = formSearch.trim().toLowerCase();
    if (!query) return formsQuery.data ?? [];
    return (formsQuery.data ?? []).filter((form) =>
      [form.name, form.description, form.workflowName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [formSearch, formsQuery.data]);

  const create = useMutation({
    mutationFn: createObservation,
    onSuccess: async (response) => {
      setCompleted(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
      ]);
      toast.success("Observation draft created.");
      router.push(`/observations/${response.observation.id}/edit`);
    },
    onError: (error) => toast.error(error.message),
  });

  function chooseStaff(id: string) {
    if (id === staffId) return;
    setStaffId(id);
    setFormKey("");
    setFormSearch("");
    if (!titleTouched) setTitle("");
    setValidationError("");
  }

  function chooseForm(form: ObservationCreationForm) {
    setFormKey(`${form.id}:${form.workflowId}`);
    if (!titleTouched && selectedStaff) {
      setTitle(`${form.name} — ${personName(selectedStaff)}`);
    }
    setValidationError("");
  }

  function validateCurrentStep(): boolean {
    let message = "";
    if (step === 0 && !selectedStaff) message = "Select a staff member to continue.";
    if (step === 1 && !selectedForm) message = "Select an observation form to continue.";
    if (step === 2) {
      if (!dueAt) message = "Due date is required.";
      else if (dueAt < localDateValue()) message = "Due date cannot be in the past.";
      else if (observationDate && dueAt < observationDate) {
        message = "Due date cannot precede the observation date.";
      } else if (!observer) message = "Unable to identify the observer.";
      else if (observer.id === selectedStaff?.id) {
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
    if (!selectedStaff || !selectedForm || !observer || !validateCurrentStep()) return;
    create.mutate({
      staffId: selectedStaff.id,
      rubricId: selectedForm.id,
      workflowId: selectedForm.workflowId,
      title: title.trim() || `${selectedForm.name} — ${personName(selectedStaff)}`,
      description: description.trim() || undefined,
      observationDate: observationDate
        ? new Date(`${observationDate}T12:00:00`).toISOString()
        : undefined,
      dueAt: new Date(`${dueAt}T23:59:59`).toISOString(),
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
            Set up the staff, form, and schedule before creating the draft.
          </p>
        </div>
        <Badge variant="outline">Step {step + 1} of {steps.length}</Badge>
      </div>

      <StepProgress current={step} />

      {validationError && (
        <Alert variant="destructive">
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
          onSelect={chooseStaff}
        />
      )}
      {step === 1 && (
        <FormStep
          forms={filteredForms}
          selected={selectedForm}
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
          onTitleChange={(value) => {
            setTitleTouched(true);
            setTitle(value);
          }}
          onDescriptionChange={setDescription}
          onObservationDateChange={setObservationDate}
          onDueAtChange={setDueAt}
        />
      )}
      {step === 3 && selectedStaff && selectedForm && observer && (
        <ReviewStep
          staff={selectedStaff}
          form={selectedForm}
          observer={observer}
          title={title.trim() || `${selectedForm.name} — ${personName(selectedStaff)}`}
          description={description}
          observationDate={observationDate}
          dueAt={dueAt}
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
        <li key={label} className={cn("rounded-xl border p-3 text-sm", index === current && "border-primary bg-primary/5", index < current && "border-success/40 bg-success/5")}>
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

function StaffStep({ staff, selected, loading, error, onSelect }: { staff: ObservationCreationStaff[]; selected: ObservationCreationStaff | null; loading: boolean; error?: string; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select staff</CardTitle>
        <CardDescription>Only active staff members you are permitted to observe are listed.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <WizardLoading /> : error ? <InlineError message={error} /> : (
          <SearchCombobox
            label="Staff member"
            placeholder="Search by name, email, department, or role..."
            value={selected ? personName(selected) : ""}
            empty="No eligible staff found."
            items={staff.map((person) => ({
              id: person.id,
              search: [person.fullName, person.email, person.department?.name, ...person.roles].filter(Boolean).join(" "),
              content: (
                <div className="min-w-0 py-1">
                  <p className="font-medium">{personName(person)}</p>
                  <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {person.department && <Badge variant="outline" className="text-[10px]">{person.department.name}</Badge>}
                    {person.roles.map((role) => <Badge key={role} variant="secondary" className="text-[10px]">{role}</Badge>)}
                  </div>
                </div>
              ),
            }))}
            onSelect={onSelect}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FormStep({ forms, selected, loading, error, search, onSearch, onSelect, isAdmin }: { forms: ObservationCreationForm[]; selected: ObservationCreationForm | null; loading: boolean; error?: string; search: string; onSearch: (value: string) => void; onSelect: (form: ObservationCreationForm) => void; isAdmin: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select observation form</CardTitle>
        <CardDescription>Forms are limited to active workflow assignments for the selected staff member.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search forms and workflows..." className="pl-9" />
        </div>
        {loading ? <WizardLoading /> : error ? <InlineError message={error} /> : forms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No observation form assigned</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin ? "Assign an active observation form to this staff role before continuing." : "Contact an administrator to assign an observation form to this staff role."}
            </p>
            {isAdmin && <Button asChild variant="outline" className="mt-4"><Link href="/rubrics?tab=observation-form">Manage observation forms</Link></Button>}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {forms.map((form) => {
              const active = selected?.id === form.id && selected.workflowId === form.workflowId;
              return (
                <button key={`${form.id}:${form.workflowId}`} type="button" onClick={() => onSelect(form)} className={cn("rounded-xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30", active && "border-primary bg-primary/5")}>
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

function DetailsStep({ title, description, observationDate, dueAt, onTitleChange, onDescriptionChange, onObservationDateChange, onDueAtChange }: { title: string; description: string; observationDate: string; dueAt: string; onTitleChange: (value: string) => void; onDescriptionChange: (value: string) => void; onObservationDateChange: (value: string) => void; onDueAtChange: (value: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>Details</CardTitle><CardDescription>Add scheduling context for the observation. You will be assigned automatically as the observer.</CardDescription></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2"><Label htmlFor="title">Title <span className="text-muted-foreground">(optional)</span></Label><Input id="title" value={title} onChange={(event) => onTitleChange(event.target.value)} maxLength={200} placeholder="Defaults to form name — staff name" /><p className="text-xs text-muted-foreground">{title.length}/200</p></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description or purpose <span className="text-muted-foreground">(optional)</span></Label><Textarea id="description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} maxLength={2000} rows={4} placeholder="Add context, focus areas, or the purpose of this observation..." /><p className="text-xs text-muted-foreground">{description.length}/2000</p></div>
        <div className="space-y-2"><Label htmlFor="observation-date">Observation date <span className="text-muted-foreground">(recommended)</span></Label><Input id="observation-date" type="date" value={observationDate} onChange={(event) => onObservationDateChange(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="due-date">Due date</Label><Input id="due-date" type="date" min={localDateValue()} value={dueAt} onChange={(event) => onDueAtChange(event.target.value)} required /></div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({ staff, form, observer, title, description, observationDate, dueAt }: { staff: ObservationCreationStaff; form: ObservationCreationForm; observer: ObservationManagerOption; title: string; description: string; observationDate: string; dueAt: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>Review and create</CardTitle><CardDescription>No server record exists yet. Confirm these details to create the draft.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</p><p className="mt-1 text-lg font-semibold">{title}</p>{description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReviewFact icon={UserRound} label="Staff" value={personName(staff)} detail={staff.department?.name ?? "No department"} />
          <ReviewFact icon={FileText} label="Form" value={form.name} detail={form.workflowName} />
          <ReviewFact icon={UsersRound} label="Observer" value={personName(observer)} detail={observer.email} />
          <ReviewFact icon={CalendarDays} label="Observation date" value={displayDate(observationDate)} />
          <ReviewFact icon={CalendarDays} label="Due date" value={displayDate(dueAt)} />
          <ReviewFact icon={ClipboardCheck} label="Notifications" value="No draft notification" detail="Staff is notified only after submission" />
        </div>
        <Alert><ClipboardCheck className="h-4 w-4" /><AlertTitle>Draft privacy</AlertTitle><AlertDescription>The staff member will not be notified and cannot see draft responses until the observer submits the observation.</AlertDescription></Alert>
      </CardContent>
    </Card>
  );
}

function ReviewFact({ icon: Icon, label, value, detail }: { icon: typeof UserRound; label: string; value: string; detail?: string }) { return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="mt-2 font-medium">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>; }

function SearchCombobox({ label, placeholder, value, empty, items, onSelect }: { label: string; placeholder: string; value: string; empty: string; items: Array<{ id: string; search: string; content: React.ReactNode }>; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal"><span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start"><Command><CommandInput name={`${label.toLowerCase().replaceAll(" ", "-")}-search`} aria-label={`Search ${label.toLowerCase()}`} placeholder={placeholder} /><CommandList><CommandEmpty>{empty}</CommandEmpty><CommandGroup>{items.map((item) => <CommandItem key={item.id} value={`${item.search} ${item.id}`} onSelect={() => { onSelect(item.id); setOpen(false); }} className="gap-3">{item.content}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}

function InlineError({ message }: { message: string }) { return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>; }
function WizardLoading() { return <div className="flex min-h-32 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</div>; }

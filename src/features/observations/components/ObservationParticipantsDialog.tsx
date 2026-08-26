"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2, Search, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  fetchObservationCreationForms,
  fetchObservationCreationStaff,
  updateObservation,
} from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import type {
  ObservationCreationStaff,
  ObservationDetail,
  ObservationScopeType,
} from "../types";

function personName(person: { email: string; fullName: string | null }) {
  return person.fullName?.trim() || person.email;
}

export function ObservationParticipantsDialog({
  observation,
  open,
  onOpenChangeAction,
}: {
  observation: ObservationDetail;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const initialIds = useMemo(
    () => (observation.participants ?? []).map((participant) => participant.id),
    [observation.participants],
  );
  const [staffIds, setStaffIds] = useState(initialIds);
  const [scopeType, setScopeType] = useState<ObservationScopeType>(
    observation.scope?.type ?? "INDIVIDUAL",
  );
  const [className, setClassName] = useState(observation.scope?.className ?? "");
  const [subjectName, setSubjectName] = useState(
    observation.scope?.subjectName ?? "",
  );

  useEffect(() => {
    if (!open) return;
    setStaffIds(initialIds);
    setScopeType(observation.scope?.type ?? "INDIVIDUAL");
    setClassName(observation.scope?.className ?? "");
    setSubjectName(observation.scope?.subjectName ?? "");
  }, [initialIds, observation.scope, open]);

  const staffQuery = useQuery({
    queryKey: observationKeys.creationStaff(),
    queryFn: fetchObservationCreationStaff,
    enabled: open,
  });
  const sortedStaffIds = useMemo(() => [...staffIds].sort(), [staffIds]);
  const formsQuery = useQuery({
    queryKey: observationKeys.creationFormsFor(sortedStaffIds),
    queryFn: () => fetchObservationCreationForms(sortedStaffIds),
    enabled: open && sortedStaffIds.length > 0,
  });
  const eligibleStaff = useMemo(
    () =>
      (staffQuery.data ?? []).filter(
        (person) => person.id !== observation.managerId,
      ),
    [observation.managerId, staffQuery.data],
  );
  const staffById = useMemo(
    () => new Map(eligibleStaff.map((person) => [person.id, person])),
    [eligibleStaff],
  );
  const selectedStaff = staffIds
    .map((id) => staffById.get(id))
    .filter((person): person is ObservationCreationStaff => Boolean(person));
  const currentRubricAvailable = Boolean(
    formsQuery.data?.some((form) => form.id === observation.rubric.id),
  );
  const scopeError =
    staffIds.length > 1 && scopeType === "INDIVIDUAL"
      ? "Multi-teacher observations must use class or subject scope."
      : scopeType === "CLASS" && !className.trim()
        ? "Class name is required for class scope."
        : scopeType === "SUBJECT" && !subjectName.trim()
          ? "Subject name is required for subject scope."
          : "";
  const selectionError =
    staffIds.length === 0
      ? "Select at least one observed teacher."
      : staffIds.length > 20
        ? "Select no more than 20 observed teachers."
        : "";

  const save = useMutation({
    mutationFn: () =>
      updateObservation(observation.id, {
        staffIds,
        scopeType,
        className: className.trim() || null,
        subjectName: subjectName.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: observationKeys.detail(observation.id),
        }),
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
        queryClient.invalidateQueries({
          queryKey: observationKeys.creationForms(),
        }),
      ]);
      toast.success("Observed teachers updated.");
      onOpenChangeAction(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function toggleStaff(id: string) {
    setStaffIds((current) => {
      if (current.includes(id)) return current.filter((staffId) => staffId !== id);
      if (current.length >= 20) {
        toast.error("You can select up to 20 observed teachers.");
        return current;
      }
      const next = [...current, id];
      if (next.length > 1 && scopeType === "INDIVIDUAL") {
        setScopeType("CLASS");
      }
      return next;
    });
  }

  const loading = staffQuery.isLoading || formsQuery.isLoading;
  const canSave =
    !loading &&
    !save.isPending &&
    !selectionError &&
    !scopeError &&
    currentRubricAvailable;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage observed teachers</DialogTitle>
          <DialogDescription>
            Draft participants are not notified. The current observation form must
            remain assigned to every selected teacher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Observed teachers ({staffIds.length}/20)</Label>
            {staffQuery.isLoading ? (
              <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading eligible staff…
              </div>
            ) : staffQuery.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{staffQuery.error.message}</AlertDescription>
              </Alert>
            ) : (
              <Command className="rounded-md border">
                <CommandInput
                  aria-label="Search eligible observed teachers"
                  placeholder="Search by name, email, department, or role…"
                />
                <CommandList className="max-h-64">
                  <CommandEmpty>No eligible staff found.</CommandEmpty>
                  <CommandGroup>
                    {eligibleStaff.map((person) => {
                      const selected = staffIds.includes(person.id);
                      const search = [
                        person.fullName,
                        person.email,
                        person.department?.name,
                        ...person.roles,
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <CommandItem
                          key={person.id}
                          value={`${search} ${person.id}`}
                          onSelect={() => toggleStaff(person.id)}
                          aria-selected={selected}
                          className="gap-3"
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                              selected &&
                                "border-primary bg-primary text-primary-foreground",
                            )}
                            aria-hidden="true"
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0 py-1">
                            <p className="font-medium">{personName(person)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {person.email}
                              {person.department?.name
                                ? ` · ${person.department.name}`
                                : ""}
                            </p>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          {selectedStaff.length > 0 && (
            <div aria-live="polite" className="flex flex-wrap gap-2">
              {selectedStaff.map((person) => (
                <Badge
                  key={person.id}
                  variant="secondary"
                  className="gap-1 py-1 pl-2 pr-1"
                >
                  <span>{personName(person)}</span>
                  <button
                    type="button"
                    onClick={() => toggleStaff(person.id)}
                    className="rounded-sm p-0.5 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${personName(person)}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">Observation context</legend>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="participant-scope">Scope</Label>
              <select
                id="participant-scope"
                value={scopeType}
                onChange={(event) =>
                  setScopeType(event.target.value as ObservationScopeType)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="INDIVIDUAL" disabled={staffIds.length > 1}>
                  Individual
                </option>
                <option value="CLASS">Class</option>
                <option value="SUBJECT">Subject</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="participant-class-name">Class name</Label>
              <Input
                id="participant-class-name"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                maxLength={200}
                required={scopeType === "CLASS"}
                placeholder="e.g. Grade 8A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participant-subject-name">Subject name</Label>
              <Input
                id="participant-subject-name"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                maxLength={200}
                required={scopeType === "SUBJECT"}
                placeholder="e.g. Mathematics"
              />
            </div>
          </fieldset>

          {(selectionError || scopeError) && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{selectionError || scopeError}</AlertDescription>
            </Alert>
          )}
          {formsQuery.error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formsQuery.error.message}</AlertDescription>
            </Alert>
          )}
          {!formsQuery.isLoading &&
            !formsQuery.error &&
            staffIds.length > 0 &&
            !currentRubricAvailable && (
              <Alert variant="destructive" role="alert">
                <Search className="h-4 w-4" />
                <AlertDescription>
                  {observation.rubric.name} is not assigned to every selected
                  teacher. Change the selection before saving.
                </AlertDescription>
              </Alert>
            )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChangeAction(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UsersRound className="h-4 w-4" />
            )}
            Save observed teachers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

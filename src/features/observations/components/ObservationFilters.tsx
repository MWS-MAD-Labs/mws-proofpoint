"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OBSERVATION_SORT_OPTIONS } from "../constants";
import type { ObservationListQuery } from "../schemas";
import type { ObservationFilterOptions } from "../api/queries";

interface ObservationFiltersProps {
  filters: ObservationListQuery;
  options: ObservationFilterOptions;
  showDepartment: boolean;
  showManager: boolean;
  onChange: (updates: Partial<Record<keyof ObservationListQuery, string | number | undefined>>) => void;
  onClear: () => void;
}

export function ObservationFilters(props: ObservationFiltersProps) {
  const [search, setSearch] = useState(props.filters.q);
  useEffect(() => setSearch(props.filters.q), [props.filters.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== props.filters.q) props.onChange({ q: search || undefined });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [props, search]);

  const chips = useMemo(() => {
    const values: Array<{ key: keyof ObservationListQuery; label: string }> = [];
    if (props.filters.status) values.push({ key: "status", label: props.filters.status });
    if (props.filters.departmentId) values.push({ key: "departmentId", label: "Department" });
    if (props.filters.managerId) values.push({ key: "managerId", label: props.filters.managerId === "me" ? "My observations" : "Observer" });
    if (props.filters.rubricId) values.push({ key: "rubricId", label: "Form" });
    if (props.filters.actionRequired === "true") values.push({ key: "actionRequired", label: "Needs action" });
    if (props.filters.overdue === "true") values.push({ key: "overdue", label: "Overdue" });
    if (props.filters.from || props.filters.to) values.push({ key: "from", label: "Date range" });
    return values;
  }, [props.filters]);

  const fields = (
    <FilterFields {...props} search={search} setSearch={setSearch} />
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 md:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Label htmlFor="observation-search-mobile" className="sr-only">Search observations</Label>
          <Input id="observation-search-mobile" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search observations" />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Observation filters</SheetTitle>
              <SheetDescription>Refine the list. Filters are saved in the page URL.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">{fields}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden rounded-xl border border-border/60 bg-card/70 p-4 md:block">{fields}</div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <Badge key={`${chip.key}-${chip.label}`} variant="secondary" className="gap-1.5 py-1">
              {chip.label}
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => props.onChange(chip.key === "from" ? { from: undefined, to: undefined } : { [chip.key]: undefined })}
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterFields({
  filters,
  options,
  showDepartment,
  showManager,
  onChange,
  onClear,
  search,
  setSearch,
}: ObservationFiltersProps & { search: string; setSearch: (value: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="hidden md:block xl:col-span-2">
        <Label htmlFor="observation-search">Search</Label>
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="observation-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Staff, observer, title, form, department" />
        </div>
      </div>
      <SelectFilter label="Status" value={filters.status ?? "all"} onValueChange={(value) => onChange({ status: value === "all" ? undefined : value })}>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="submitted">Awaiting acknowledgement</SelectItem>
        <SelectItem value="acknowledged">Completed</SelectItem>
      </SelectFilter>
      <SelectFilter label="Sort" value={filters.sort} onValueChange={(value) => onChange({ sort: value })}>
        {OBSERVATION_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectFilter>
      {showDepartment && (
        <SelectFilter label="Department" value={filters.departmentId ?? "all"} onValueChange={(value) => onChange({ departmentId: value === "all" ? undefined : value })}>
          <SelectItem value="all">All departments</SelectItem>
          {options.departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
        </SelectFilter>
      )}
      {showManager && (
        <SelectFilter label="Observer" value={filters.managerId ?? "all"} onValueChange={(value) => onChange({ managerId: value === "all" ? undefined : value })}>
          <SelectItem value="all">All observers</SelectItem>
          <SelectItem value="me">My observations</SelectItem>
          {options.managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.fullName || manager.email}</SelectItem>)}
        </SelectFilter>
      )}
      <SelectFilter label="Observation form" value={filters.rubricId ?? "all"} onValueChange={(value) => onChange({ rubricId: value === "all" ? undefined : value })}>
        <SelectItem value="all">All forms</SelectItem>
        {options.rubrics.map((rubric) => <SelectItem key={rubric.id} value={rubric.id}>{rubric.name}</SelectItem>)}
      </SelectFilter>
      <div>
        <Label htmlFor="observation-from">Observation date from</Label>
        <Input id="observation-from" type="date" className="mt-1.5" value={filters.from ?? ""} onChange={(event) => onChange({ from: event.target.value || undefined })} />
      </div>
      <div>
        <Label htmlFor="observation-to">Observation date to</Label>
        <Input id="observation-to" type="date" className="mt-1.5" value={filters.to ?? ""} onChange={(event) => onChange({ to: event.target.value || undefined })} />
      </div>
      <div className="flex flex-wrap items-end gap-5 xl:col-span-2">
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={filters.actionRequired === "true"} onCheckedChange={(checked) => onChange({ actionRequired: checked === true ? "true" : undefined })} />
          Needs action
        </label>
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={filters.overdue === "true"} onCheckedChange={(checked) => onChange({ overdue: checked === true ? "true" : undefined })} />
          Overdue
        </label>
        <Button type="button" variant="ghost" className="gap-2" onClick={onClear}>
          <RotateCcw className="h-4 w-4" /> Clear filters
        </Button>
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onValueChange, children }: { label: string; value: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
  const id = `observation-filter-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="mt-1.5"><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

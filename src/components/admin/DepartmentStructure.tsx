"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Pencil,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DepartmentRoleAssignment } from "./DepartmentRoleAssignmentDialog";

export interface DepartmentStructureUser {
  id: string;
  email: string;
  full_name: string | null;
}

export interface DepartmentStructureRoleHolder {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export interface DepartmentStructureDepartment {
  id: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  user_count: string;
  hierarchy_level: "root" | "department" | "subdepartment";
  role_holders: DepartmentStructureRoleHolder[];
}

interface DepartmentStructureProps {
  departments: DepartmentStructureDepartment[];

  roleAssignments: DepartmentRoleAssignment[];
  onCreateDepartment: () => void;
  onEditDepartment: (department: DepartmentStructureDepartment) => void;
  onDeleteDepartment: (department: DepartmentStructureDepartment) => void;
  onManageRole: (departmentId: string | null, role: string) => void;
  onEditUser: (userId: string) => void;
}

function personName(person: DepartmentStructureRoleHolder) {
  return person.full_name || person.email;
}

export function DepartmentStructure({
  departments,

  roleAssignments,
  onCreateDepartment,
  onEditDepartment,
  onDeleteDepartment,
  onManageRole,
  onEditUser,
}: DepartmentStructureProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { byId, childrenByParent, roots } = useMemo(() => {
    const byId = new Map(departments.map((department) => [department.id, department]));
    const childrenByParent = new Map<string | null, DepartmentStructureDepartment[]>();
    for (const department of departments) {
      const siblings = childrenByParent.get(department.parent_id) ?? [];
      siblings.push(department);
      childrenByParent.set(department.parent_id, siblings);
    }
    for (const siblings of childrenByParent.values()) {
      siblings.sort((left, right) => left.name.localeCompare(right.name));
    }
    return { byId, childrenByParent, roots: childrenByParent.get(null) ?? [] };
  }, [departments]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedPath = useMemo(() => {
    if (!selected) return [];
    const path: DepartmentStructureDepartment[] = [];
    let current: DepartmentStructureDepartment | undefined = selected;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return path;
  }, [byId, selected]);

  const matchingIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return new Set<string>();
    return new Set(departments.filter((department) => department.name.toLowerCase().includes(term)).map((department) => department.id));
  }, [departments, search]);

  useEffect(() => {
    if (!departments.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !byId.has(selectedId)) setSelectedId(roots[0]?.id ?? departments[0]?.id ?? null);
  }, [byId, departments, roots, selectedId]);

  useEffect(() => {
    if (!matchingIds.size) return;
    const firstMatch = departments.find((department) => matchingIds.has(department.id));
    if (!firstMatch) return;
    setSelectedId(firstMatch.id);
    setExpanded((current) => {
      const next = new Set(current);
      let parentId = firstMatch.parent_id;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        next.add(parentId);
        visited.add(parentId);
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
      return next;
    });
  }, [byId, departments, matchingIds]);

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderBranch = (department: DepartmentStructureDepartment, depth = 0): React.ReactNode => {
    const children = childrenByParent.get(department.id) ?? [];
    const managers = department.role_holders.filter((holder) => holder.role === "manager");
    const supervisors = department.role_holders.filter((holder) => holder.role === "supervisor");
    const staff = department.role_holders.filter((holder) => holder.role === "staff");
    const isSelected = selected?.id === department.id;
    const isMatch = matchingIds.has(department.id);
    const hasChildren = children.length > 0;

    return (
      <div key={department.id} className="min-w-0">
        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          {hasChildren ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label={`${expanded.has(department.id) ? "Collapse" : "Expand"} ${department.name}`}
              onClick={() => toggle(department.id)}
            >
              {expanded.has(department.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : <span className="w-8 shrink-0" aria-hidden="true" />}
          <button
            type="button"
            onClick={() => setSelectedId(department.id)}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/50"}`}
          >
            <Building className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{department.name}</span>
            {isMatch && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Search match" />}
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{children.length} child{children.length === 1 ? "" : "ren"}</span>
            <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">M {managers.length} · V {supervisors.length} · S {staff.length}</span>
          </button>
        </div>
        {hasChildren && expanded.has(department.id) && <div className="mt-1">{children.map((child) => renderBranch(child, depth + 1))}</div>}
      </div>
    );
  };

  const globalAssignments = roleAssignments.filter((assignment) => assignment.department_id === null && ["director", "admin"].includes(assignment.role));
  const children = selected ? childrenByParent.get(selected.id) ?? [] : [];
  const managers = selected?.role_holders.filter((holder) => holder.role === "manager") ?? [];
  const supervisors = selected?.role_holders.filter((holder) => holder.role === "supervisor") ?? [];
  const staff = selected?.role_holders.filter((holder) => holder.role === "staff") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><FolderTree className="h-5 w-5 text-primary" />Department Structure</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse the organisation, then manage assignments in context.</p>
        </div>
        <Button onClick={onCreateDepartment}><Building className="mr-2 h-4 w-4" />Add Department</Button>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <Card className="min-w-0 border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Organisation navigator</CardTitle>
            <div className="relative pt-2"><Search className="absolute left-3 top-5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Find a department..." /></div>
          </CardHeader>
          <CardContent className="max-h-[620px] overflow-y-auto pb-5">
            {!departments.length ? <EmptyDepartments onCreate={onCreateDepartment} /> : (
              <div className="space-y-1" aria-label="Department hierarchy">{roots.map((root) => renderBranch(root))}</div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/60">
          {!selected ? <EmptyDepartments onCreate={onCreateDepartment} /> : (
            <>
              <CardHeader className="gap-4 space-y-0 border-b border-border/50 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardDescription className="mb-2 break-words">{selectedPath.map((department) => department.name).join(" / ")}</CardDescription>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-2xl"><Building className="h-5 w-5 text-primary" />{selected.name}<Badge variant="outline" className="capitalize">{selected.hierarchy_level}</Badge></CardTitle>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="icon" aria-label={`Edit ${selected.name}`} onClick={() => onEditDepartment(selected)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" aria-label={`Delete ${selected.name}`} className="text-destructive hover:text-destructive" onClick={() => onDeleteDepartment(selected)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Immediate children" value={String(children.length)} />
                  <Stat label="Managers" value={String(managers.length)} />
                  <Stat label="Supervisors" value={String(supervisors.length)} />
                  <Stat label="Staff" value={String(staff.length)} />
                </div>
                <RolePanel title="Managers" role="manager" people={managers} department={selected} onManageRole={onManageRole} onEditUser={onEditUser} />
                {roleAssignments.some((assignment) => assignment.department_id === selected.id && assignment.role === "supervisor") && (
                  <RolePanel title="Supervisors" role="supervisor" people={supervisors} department={selected} onManageRole={onManageRole} onEditUser={onEditUser} />
                )}
                <RolePanel title="Staff" role="staff" people={staff} department={selected} onManageRole={onManageRole} onEditUser={onEditUser} />
                <section>
                  <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Immediate child departments</h3><span className="text-sm text-muted-foreground">{children.length}</span></div>
                  {children.length ? <div className="flex flex-wrap gap-2">{children.map((child) => <Button key={child.id} variant="outline" size="sm" onClick={() => { setSelectedId(child.id); setExpanded((current) => new Set(current).add(selected.id)); }}>{child.name}</Button>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No child departments.</p>}
                </section>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">Organisation-wide roles</CardTitle><CardDescription>These roles apply across departments and are managed separately from departmental assignments.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {globalAssignments.map((assignment) => <div key={assignment.department_role_id} className="rounded-lg border p-4"><div className="mb-3 flex items-center justify-between gap-2"><Badge className="capitalize">{assignment.role}</Badge><Button size="sm" variant="outline" onClick={() => onManageRole(null, assignment.role)}>Manage</Button></div>{assignment.assignees.length ? <div className="space-y-1">{assignment.assignees.map((person) => <p key={person.user_id} className="truncate text-sm">{person.full_name || person.email}</p>)}</div> : <p className="text-sm italic text-muted-foreground">No assignee</p>}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function RolePanel({ title, role, people, department, onManageRole, onEditUser }: { title: string; role: string; people: DepartmentStructureRoleHolder[]; department: DepartmentStructureDepartment; onManageRole: (departmentId: string, role: string) => void; onEditUser: (userId: string) => void }) {
  return <section className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-semibold">{title}</h3></div><Button size="sm" variant="outline" onClick={() => onManageRole(department.id, role)}>Manage {title.toLowerCase()}</Button></div>{people.length ? <div className="space-y-2">{people.map((person) => <button key={person.user_id} type="button" onClick={() => onEditUser(person.user_id)} className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><UserRound className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{personName(person)}</span><span className="truncate text-xs text-muted-foreground">{person.email}</span></button>)}</div> : <p className="rounded-lg bg-muted/40 p-3 text-sm italic text-muted-foreground">No {title.toLowerCase()} assigned.</p>}</section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function EmptyDepartments({ onCreate }: { onCreate: () => void }) {
  return <div className="p-8 text-center"><FolderTree className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">No departments yet</p><p className="mt-1 text-sm text-muted-foreground">Create a top-level department to begin the organisation structure.</p><Button className="mt-4" size="sm" onClick={onCreate}>Add Department</Button></div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";

export interface AssignableUser {
  id: string;
  email: string;
  full_name: string | null;
  department_name: string | null;
  status: string;
}

export interface DepartmentRoleAssignment {
  department_role_id: string;
  department_id: string | null;
  department_name: string | null;
  role: string;
  assignees: Array<{
    user_id: string;
    email: string;
    full_name: string | null;
  }>;
}

interface DepartmentRoleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: DepartmentRoleAssignment | null;
  users: AssignableUser[];
  onSaved: () => Promise<void> | void;
}

export function DepartmentRoleAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  users,
  onSaved,
}: DepartmentRoleAssignmentDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(new Set(assignment?.assignees.map((user) => user.user_id) ?? []));
    setSearch("");
  }, [assignment, open]);

  const availableUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((user) => user.status !== "deleted")
      .filter((user) => {
        if (!term) return true;
        return [user.full_name, user.email, user.department_name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));
      })
      .sort((left, right) =>
        (left.full_name || left.email).localeCompare(right.full_name || right.email),
      );
  }, [search, users]);

  const toggleUser = (userId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const save = async () => {
    if (!assignment) return;
    if (assignment.role === "admin" && selected.size === 0) {
      toast({
        title: "At least one admin is required",
        description: "Assign another admin before removing the final administrator.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const result = await api.updateDepartmentRoleMemberships(
      assignment.department_role_id,
      Array.from(selected),
    );
    setSaving(false);

    if (result.error) {
      toast({
        title: "Unable to update assignments",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Assignments updated",
      description: `${selected.size} user(s) assigned as ${assignment.role}.`,
    });
    await onSaved();
    onOpenChange(false);
  };

  const scopeName = assignment?.department_name ?? "Global Level";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl glass-panel-strong">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 capitalize">
            <Users className="h-5 w-5" />
            Manage {assignment?.role ?? "role"} assignments
          </DialogTitle>
          <DialogDescription>
            Add or remove users for {scopeName}. A person may be assigned to more
            than one department role.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or department..."
            className="pl-9"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto rounded-lg border">
          {availableUsers.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No users match your search.
            </p>
          ) : (
            availableUsers.map((user) => {
              const checked = selected.has(user.id);
              return (
                <div
                  key={user.id}
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={0}
                  onClick={() => toggleUser(user.id)}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      toggleUser(user.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 border-b p-3 text-left last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <Checkbox
                    checked={checked}
                    aria-label={`Select ${user.full_name || user.email}`}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={() => toggleUser(user.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {user.full_name || user.email}
                      </p>
                      {user.status !== "active" && (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                          {user.status}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                      {user.department_name ? ` · ${user.department_name}` : " · Unassigned"}
                    </p>
                  </div>
                  {checked && <Check className="h-4 w-4 text-primary" />}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || !assignment}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save assignments
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

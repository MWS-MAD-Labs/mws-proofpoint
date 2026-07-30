"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { api } from "@/lib/api-client";
import { getAutomaticPeriod } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

interface StaffAssignment {
  id: string;
  email: string;
  fullName: string | null;
  departmentName: string;
  departmentRoleId: string;
  templateId: string;
  templateName: string;
  activeAssessmentId: string | null;
  activeAssessmentStatus: string | null;
}

function NewStaffAppraisal() {
  const router = useRouter();
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
  const [staffAssignmentKey, setStaffAssignmentKey] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);

  useEffect(() => {
    setPeriod(getAutomaticPeriod());
    fetch("/api/assessments/staff")
      .then((response) => response.json())
      .then((result) => setStaffAssignments((result.data ?? []) as StaffAssignment[]))
      .catch(() => toast({ title: "Error", description: "Could not load staff assignments", variant: "destructive" }));
  }, []);

  const selectedAssignment = useMemo(
    () => staffAssignments.find((assignment) => `${assignment.id}:${assignment.departmentRoleId}` === staffAssignmentKey) ?? null,
    [staffAssignments, staffAssignmentKey],
  );
  const activeAssessment = selectedAssignment?.activeAssessmentId
    ? { id: selectedAssignment.activeAssessmentId, status: selectedAssignment.activeAssessmentStatus ?? "draft" }
    : null;

  const selectStaffAssignment = (value: string) => {
    setStaffAssignmentKey(value);
    const assignment = staffAssignments.find((item) => `${item.id}:${item.departmentRoleId}` === value);
    if (assignment?.activeAssessmentId) setDraftDialogOpen(true);
  };

  async function create() {
    if (!selectedAssignment || !period) return;
    setSaving(true);
    const { data, error } = await api.createAssessment({
      staff_id: selectedAssignment.id,
      template_id: selectedAssignment.templateId,
      period,
    });
    setSaving(false);

    if (error || !data) {
      toast({ title: "Unable to create appraisal", description: error?.message ?? "Confirm the staff workflow assignment.", variant: "destructive" });
      return;
    }
    router.replace(`/manager?id=${(data as { id: string }).id}`);
  }

  async function discardDraftAndCreate() {
    if (!activeAssessment) return;
    setSaving(true);
    const { error } = await api.deleteAssessment(activeAssessment.id);
    setSaving(false);
    if (error) {
      toast({ title: "Unable to discard draft", description: error.message, variant: "destructive" });
      return;
    }
    setStaffAssignments((current) => current.map((assignment) =>
      assignment.activeAssessmentId === activeAssessment.id
        ? { ...assignment, activeAssessmentId: null, activeAssessmentStatus: null }
        : assignment,
    ));
    setDraftDialogOpen(false);
    await create();
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Start Staff Appraisal</CardTitle>
          <CardDescription>Manager draft → director review → staff acknowledgement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Staff member</Label>
            <Select value={staffAssignmentKey} onValueChange={selectStaffAssignment}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {staffAssignments.map((assignment) => (
                  <SelectItem key={`${assignment.id}:${assignment.departmentRoleId}`} value={`${assignment.id}:${assignment.departmentRoleId}`}>
                    {assignment.fullName ?? assignment.email} · {assignment.departmentName}
                    {assignment.activeAssessmentId ? " · Active appraisal" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {staffAssignments.length === 0 && (
              <p className="text-xs text-muted-foreground">No staff with an active staff-appraisal assignment are available in your managed departments.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Staff appraisal rubric</Label>
            <Input value={selectedAssignment?.templateName ?? "Select a staff member first"} readOnly className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Automatically selected from the staff member’s department-role workflow assignment.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Review period</Label>
            <Input id="period" value={period} readOnly className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Automatically set to the current appraisal period.</p>
          </div>

          {activeAssessment && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This staff member already has an active appraisal for this rubric and period.
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push("/appraisals")}>Cancel</Button>
            <Button disabled={saving || !selectedAssignment || !period || Boolean(activeAssessment)} onClick={create}>
              {saving ? "Creating…" : "Create Draft"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active appraisal found</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAssignment?.fullName ?? "This staff member"} already has an active appraisal for {period} using the {selectedAssignment?.templateName} rubric.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => activeAssessment && router.replace(`/manager?id=${activeAssessment.id}`)}>
              Continue appraisal
            </Button>
            {activeAssessment?.status === "draft" && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={saving}
                onClick={(event) => {
                  event.preventDefault();
                  void discardDraftAndCreate();
                }}
              >
                {saving ? "Discarding…" : "Discard draft & create new"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Page() {
  return <ProtectedRoute requiredRoles={["manager", "admin"]}><Header /><NewStaffAppraisal /></ProtectedRoute>;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Staff { id: string; email: string; fullName: string | null }
interface Rubric { id: string; name: string }

function NewStaffAppraisal() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [staffId, setStaffId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/assessments/staff")
      .then((response) => response.json())
      .then((result) => setStaff(result.data ?? []))
      .catch(() => toast({ title: "Error", description: "Could not load staff", variant: "destructive" }));
    api.getRubrics("STAFF_APPRAISAL").then(({ data }) => setRubrics((data as Rubric[]) ?? []));
  }, []);

  async function create() {
    if (!staffId || !templateId || !period.trim()) return;
    setSaving(true);
    const { data, error } = await api.createAssessment({ staff_id: staffId, template_id: templateId, period: period.trim() });
    setSaving(false);
    if (error || !data) {
      toast({ title: "Unable to create appraisal", description: error?.message ?? "Confirm that this rubric is assigned to the staff appraisal workflow.", variant: "destructive" });
      return;
    }
    router.replace(`/manager?id=${(data as { id: string }).id}`);
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
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map((person) => <SelectItem key={person.id} value={person.id}>{person.fullName ?? person.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Staff appraisal rubric</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Select staff appraisal rubric" /></SelectTrigger>
              <SelectContent>{rubrics.map((rubric) => <SelectItem key={rubric.id} value={rubric.id}>{rubric.name}</SelectItem>)}</SelectContent>
            </Select>
            {rubrics.length === 0 && <p className="text-xs text-muted-foreground">Create a Staff Appraisal rubric and assign it to the staff workflow first.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="period">Review period</Label>
            <Input id="period" value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="e.g. Semester 1 2026/2027" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push("/appraisals")}>Cancel</Button>
            <Button disabled={saving || !staffId || !templateId || !period.trim()} onClick={create}>{saving ? "Creating…" : "Create Draft"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return <ProtectedRoute requiredRoles={["manager", "admin"]}><Header /><NewStaffAppraisal /></ProtectedRoute>;
}

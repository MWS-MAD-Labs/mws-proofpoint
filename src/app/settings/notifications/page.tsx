"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface NotificationPreferences {
  emailEnabled: boolean;
  assessmentSubmitted: boolean;
  managerReviewDone: boolean;
  directorApproved: boolean;
  adminReleased: boolean;
  assessmentReturned: boolean;
  assessmentAcknowledged: boolean;
}

export default function NotificationPreferencesPage() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    assessmentSubmitted: true,
    managerReviewDone: true,
    directorApproved: true,
    adminReleased: true,
    assessmentReturned: true,
    assessmentAcknowledged: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.data) {
        setPreferences((prev) => ({
          ...prev,
          ...data.data,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Notification Preferences</h1>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Choose which appraisal email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable Appraisal Email Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Turn off to disable your appraisal emails. Mandatory observation workflow emails follow the organisation&apos;s global policy and are not disabled here.
              </p>
            </div>
            <Switch
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) =>
                updatePreference("emailEnabled", checked)
              }
            />
          </div>

          {!preferences.emailEnabled && (
            <p className="text-sm text-warning-foreground bg-warning-soft p-3 rounded">
              Your appraisal emails are currently disabled. Mandatory observation workflow communications may still be sent under the global administrator-managed policy.
            </p>
          )}

          <div className="space-y-4 pt-4 border-t">
            <PreferenceRow
              label="Assessment Submitted"
              description="When a team member submits an assessment for review"
              checked={preferences.assessmentSubmitted}
              onChange={(checked) =>
                updatePreference("assessmentSubmitted", checked)
              }
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Manager Review Completed"
              description="When a manager completes their review"
              checked={preferences.managerReviewDone}
              onChange={(checked) =>
                updatePreference("managerReviewDone", checked)
              }
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Director Approved"
              description="When a director approves an assessment"
              checked={preferences.directorApproved}
              onChange={(checked) =>
                updatePreference("directorApproved", checked)
              }
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Assessment Released"
              description="When your assessment is released for acknowledgement"
              checked={preferences.adminReleased}
              onChange={(checked) => updatePreference("adminReleased", checked)}
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Assessment Returned"
              description="When an assessment is returned for revision"
              checked={preferences.assessmentReturned}
              onChange={(checked) =>
                updatePreference("assessmentReturned", checked)
              }
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Assessment Acknowledged"
              description="When an assessment cycle is completed"
              checked={preferences.assessmentAcknowledged}
              onChange={(checked) =>
                updatePreference("assessmentAcknowledged", checked)
              }
              disabled={!preferences.emailEnabled}
            />

          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-6">
            <p className="font-medium text-foreground">Observation workflow emails</p>
            <p className="text-muted-foreground">
              Submission, reminder, acknowledgement, reopen, and reassignment communications are managed globally by administrators and may be mandatory. These appraisal preferences do not control them.
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={savePreferences} disabled={saving}>
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium">{label}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

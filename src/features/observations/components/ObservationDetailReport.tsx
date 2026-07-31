"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Loader2,
  LockKeyhole,
  PencilLine,
  RefreshCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  acknowledgeObservation,
  deleteObservation,
  reopenObservation,
} from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import { OBSERVATION_STATUS } from "../constants";
import {
  getObservationAgeStart,
  getObservationPrimaryAction,
  shouldShowObservationResponses,
  sortObservationActivity,
} from "../detailPresentation";
import type {
  ObservationAnswer,
  ObservationDetailResponse,
  ObservationRubricIndicator,
  ObservationStatus,
} from "../types";
import {
  formatExactDate,
  formatObservationDate,
  formatRelativeDate,
} from "../utils";
import { ObservationStatusBadge } from "./ObservationStatusBadge";
import { ObservationReassignmentDialog } from "./ObservationReassignmentDialog";

const stages: Array<{
  status: ObservationStatus;
  label: string;
  icon: typeof Clock3;
}> = [
  { status: "draft", label: "Draft", icon: FileText },
  { status: "submitted", label: "Awaiting acknowledgement", icon: Clock3 },
  { status: "acknowledged", label: "Complete", icon: CheckCircle2 },
];

const stageIndex: Record<ObservationStatus, number> = {
  draft: 0,
  submitted: 1,
  acknowledged: 2,
};

const actionContent: Record<
  "acknowledge" | "reopen",
  {
    label: string;
    title: string;
    description: string;
    success: string;
    icon: typeof CheckCircle2;
    className?: string;
  }
> = {
  acknowledge: {
    label: "Acknowledge report",
    title: "Acknowledge this observation?",
    description:
      "This confirms that you have reviewed the report. The observation will be marked completed.",
    success: "Observation acknowledged and marked completed.",
    icon: CheckCircle2,
    className: "bg-success hover:bg-success",
  },
  reopen: {
    label: "Reopen for revision",
    title: "Reopen this observation?",
    description:
      "The observation will return to draft. Staff and directors will no longer see its responses until it is submitted again.",
    success: "Observation reopened as a draft.",
    icon: RefreshCcw,
  },
};

export function ObservationDetailReport({
  detail,
}: {
  detail: ObservationDetailResponse;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { observation, permissions } = detail;
  const primaryAction = getObservationPrimaryAction(permissions);
  const showResponses = shouldShowObservationResponses(permissions);
  const action = useMutation({
    mutationFn: async ({
      kind,
      reason,
    }: {
      kind: "acknowledge" | "reopen";
      reason?: string;
    }) => {
      if (kind === "acknowledge") {
        return acknowledgeObservation(observation.id, {
          response: reason ?? "",
        });
      }
      return reopenObservation(observation.id, { reason: reason ?? "" });
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: observationKeys.detail(observation.id) }),
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast.success(actionContent[variables.kind].success);
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteObservation(observation.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: observationKeys.detail(observation.id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
      ]);
      toast.success("Observation deleted.");
      router.push("/observations/all");
    },
    onError: (error) => toast.error(error.message),
  });

  const answersByIndicator = new Map(
    (observation.answers ?? []).map((answer) => [answer.indicatorId, answer]),
  );


  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/observations/all">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All observations
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {permissions.canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete observation
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this observation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the draft or pending observation and all saved responses. Completed observations cannot be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={remove.isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      remove.mutate();
                    }}
                  >
                    {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete observation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {permissions.canReassign && (
            <ObservationReassignmentDialog
              observationId={observation.id}
              currentManagerId={observation.managerId}
            />
          )}
          {primaryAction === "edit" && (
            <Button asChild className="gap-2">
              <Link href={`/observations/${observation.id}/edit`}>
                <PencilLine className="h-4 w-4" />
                Continue editing
              </Link>
            </Button>
          )}
        {(primaryAction === "acknowledge" || primaryAction === "reopen") && (
          <ObservationActionDialog
            action={primaryAction}
            loading={action.isPending}
            progress={observation.progress}
            onConfirm={(reason) =>
              action.mutate({ kind: primaryAction, reason })
            }
          />
        )}
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <ObservationStatusBadge status={observation.status} />
              <span className="text-sm text-muted-foreground">
                Updated {formatRelativeDate(observation.updatedAt)}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {observation.title?.trim() || observation.rubric.name}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {observation.rubric.name}
              </p>
              {observation.description && (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {observation.description}
                </p>
              )}
            </div>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
            <HeaderFact
              icon={UserRound}
              label="Staff"
              value={personName(observation.staff, "Unknown")}
            />
            <HeaderFact
              icon={UserRound}
              label="Manager"
              value={personName(observation.manager, "Unassigned")}
            />
            <HeaderFact
              icon={CalendarDays}
              label="Observation date"
              value={formatObservationDate(observation.observationDate)}
            />
            <HeaderFact
              icon={CalendarDays}
              label="Due date"
              value={formatObservationDate(observation.dueAt)}
            />
          </div>
        </div>
      </section>

      <ObservationLifecycle observation={observation} />

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Required progress"
              value={
                observation.progress
                  ? `${observation.progress.requiredAnswered}/${observation.progress.requiredTotal}`
                  : "Private"
              }
              description={
                observation.progress
                  ? `${observation.progress.percentage}% complete`
                  : "Draft response progress is hidden for your role"
              }
            />

            <MetricCard
              label="Current stage age"
              value={formatRelativeDate(getObservationAgeStart(observation))}
              description={OBSERVATION_STATUS[observation.status].description}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Report metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Metadata label="Form" value={observation.rubric.name} />
              <Metadata
                label="Department"
                value={observation.staff?.profile.department?.name ?? "Not assigned"}
              />
              <Metadata label="Created" value={formatExactDate(observation.createdAt)} />
              <Metadata
                label="Submitted"
                value={observation.submittedAt ? formatExactDate(observation.submittedAt) : "Not submitted"}
              />
              <Metadata
                label="Acknowledged"
                value={observation.acknowledgedAt ? formatExactDate(observation.acknowledgedAt) : "Not acknowledged"}
              />
              <Metadata
                label="Last reopened"
                value={observation.reopenedAt ? formatExactDate(observation.reopenedAt) : "Never"}
              />
            </CardContent>
          </Card>

          {observation.acknowledgementResponse && (
            <Card>
              <CardHeader>
                <CardTitle>Acknowledgement response</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {observation.acknowledgementResponse}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  By {personName(observation.staff, "Unknown staff")}
                </p>
              </CardContent>
            </Card>
          )}

          {observation.progress && (
            <Card>
              <CardHeader>
                <CardTitle>Completion progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Required indicators</span>
                  <span className="font-medium">{observation.progress.percentage}%</span>
                </div>
                <Progress value={observation.progress.percentage} className="h-2" />
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p>{observation.progress.requiredAnswered} of {observation.progress.requiredTotal} required responses complete</p>
                  <p className="text-muted-foreground">{observation.progress.optionalAnswered} of {observation.progress.optionalTotal} optional responses complete</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="responses">
          {showResponses ? (
            <ResponsesReport
              sections={observation.rubric.sections}
              answersByIndicator={answersByIndicator}
            />
          ) : (
            <PrivateDraftShell />
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ActivityReport activity={sortObservationActivity(observation.activity)} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ObservationLifecycle({
  observation,
}: {
  observation: ObservationDetailResponse["observation"];
}) {
  const current = stageIndex[observation.status];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Lifecycle</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4 md:grid-cols-3">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const reached = index <= current;
            const active = index === current;
            const completedLabel =
              stage.status === "draft"
                ? "Submitted"
                : stage.status === "submitted"
                  ? "Acknowledged"
                  : "Complete";
            const label = reached && !active ? completedLabel : stage.label;
            const timestamp =
              stage.status === "draft"
                ? observation.status === "draft"
                  ? observation.reopenedAt ?? observation.createdAt
                  : observation.submittedAt
                : stage.status === "submitted"
                  ? observation.status === "acknowledged"
                    ? observation.acknowledgedAt
                    : null
                  : observation.acknowledgedAt;
            const actor =
              stage.status === "draft"
                ? observation.manager
                : stage.status === "submitted"
                  ? observation.staff
                  : null;
            return (
              <li key={stage.status} className="relative">
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    active && "border-primary/40 bg-primary/5",
                    reached && !active && "border-success/30 bg-success/5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-full bg-muted p-2", reached && "bg-primary/10 text-primary")}>
                      {reached && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {timestamp
                          ? `${formatExactDate(timestamp)} · ${formatRelativeDate(timestamp)}`
                          : "Not reached"}
                      </p>
                      {timestamp && actor && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          By {personName(actor, "Unknown")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function ResponsesReport({
  sections,
  answersByIndicator,
}: {
  sections: ObservationDetailResponse["observation"]["rubric"]["sections"];
  answersByIndicator: Map<string, ObservationAnswer>;
}) {
  if (sections.length === 0) {
    return <EmptyState icon={FileText} title="No rubric sections" description="This form has no sections or indicators." />;
  }
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{section.name}</CardTitle>
              {section.weight !== null && <Badge variant="secondary">Weight {section.weight}%</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.indicators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No indicators in this section.</p>
            ) : (
              section.indicators.map((indicator, index) => (
                <div key={indicator.id}>
                  {index > 0 && <Separator className="mb-4" />}
                  <IndicatorResponse
                    indicator={indicator}
                    answer={answersByIndicator.get(indicator.id)}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IndicatorResponse({
  indicator,
  answer,
}: {
  indicator: ObservationRubricIndicator;
  answer?: ObservationAnswer;
}) {
  const answerValue =
    indicator.questionType === "SCALE"
      ? answer?.score && answer.score > 0
        ? `${answer.score.toFixed(1)} / 4`
        : null
      : indicator.questionType === "TEXT"
        ? answer?.textValue?.trim() || null
        : answer?.selectedOption?.trim() ||
          answer?.selectedOptions?.filter(Boolean).join(", ") ||
          null;
  return (
    <article className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{indicator.name}</h3>
            <Badge variant="outline" className="text-[10px]">{indicator.questionType}</Badge>
            {indicator.isRequired && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
          </div>
          {indicator.description && <p className="mt-1 text-sm text-muted-foreground">{indicator.description}</p>}
        </div>
        {indicator.questionType === "SCALE" && answerValue && (
          <span className="text-2xl font-semibold text-primary">{answerValue}</span>
        )}
      </div>
      {indicator.questionType !== "SCALE" && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          {answerValue ?? <span className="italic text-muted-foreground">No response</span>}
        </div>
      )}
      {answer?.note && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{answer.note}</p>
        </div>
      )}
      {answer?.evidence && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{answer.evidence}</p>
        </div>
      )}
      {indicator.evidenceGuidance && (
        <p className="text-xs text-muted-foreground">Guidance: {indicator.evidenceGuidance}</p>
      )}
    </article>
  );
}

function ActivityReport({
  activity,
}: {
  activity: ObservationDetailResponse["observation"]["activity"];
}) {
  if (activity.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Status changes and audit events will appear here." />;
  }
  return (
    <Card>
      <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
      <CardContent>
        <ol className="space-y-5">
          {activity.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {activityTitle(entry.eventType, entry.statusTo)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {personName(entry.updatedBy, "System")}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
                    {formatExactDate(entry.createdAt)}
                  </time>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {entry.statusFrom && <ObservationStatusBadge status={entry.statusFrom} />}
                  {entry.statusFrom && <span className="text-muted-foreground">to</span>}
                  <ObservationStatusBadge status={entry.statusTo} />
                </div>
                {entry.notes && <p className="mt-3 text-sm text-muted-foreground">{entry.notes}</p>}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function PrivateDraftShell() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <div className="rounded-full bg-muted p-4"><LockKeyhole className="h-7 w-7 text-muted-foreground" /></div>
        <h2 className="mt-4 text-lg font-semibold">Responses are private while this report is a draft</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          You can view the report metadata and lifecycle now. Scores, notes, and responses will appear after the manager submits the observation.
        </p>
      </CardContent>
    </Card>
  );
}

function ObservationActionDialog({
  action,
  loading,
  progress,
  onConfirm,
}: {
  action: "acknowledge" | "reopen";
  loading: boolean;
  progress: ObservationDetailResponse["observation"]["progress"];
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const content = actionContent[action];
  const Icon = content.icon;
  const trimmedReason = reason.trim();
  const invalidReason = trimmedReason.length < 10;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className={cn("gap-2", content.className)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {content.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {action === "acknowledge" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p>I confirm that I have reviewed this observation.</p>
              <p className="mt-2 text-muted-foreground">
                Acknowledgement confirms review, not agreement, and cannot be undone by staff.
              </p>
              {progress && (
                <p className="mt-2 text-muted-foreground">
                  Required responses: {progress.requiredAnswered}/{progress.requiredTotal} complete.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="acknowledgement-response" className="text-sm font-medium">
                Acknowledgement response
              </label>
              <Textarea
                id="acknowledgement-response"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Share your response to this observation..."
                maxLength={2000}
                rows={5}
                required
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Required. Minimum 10 characters.</span>
                <span>{trimmedReason.length}/2000</span>
              </div>
            </div>
          </div>
        )}
        {action === "reopen" && (
          <div className="space-y-2">
            <label htmlFor="reopen-reason" className="text-sm font-medium">
              Reason for reopening
            </label>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what needs to be revised..."
              maxLength={500}
              rows={4}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Minimum 10 characters. Manager and staff will be notified.</span>
              <span>{trimmedReason.length}/500</span>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(trimmedReason)}
            className={content.className}
            disabled={loading || invalidReason}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function HeaderFact({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <p className="mt-2 truncate font-medium" title={value}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></CardContent></Card>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof History; title: string; description: string }) {
  return <Card className="border-dashed"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><Icon className="h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></CardContent></Card>;
}

function personName(person: { email: string; profile: { fullName: string | null } } | null, fallback: string): string {
  return person?.profile.fullName?.trim() || person?.email || fallback;
}

function activityTitle(eventType: string, status: ObservationStatus): string {
  if (eventType === "created") return "Observation created";
  if (eventType === "submitted") return "Observation submitted";
  if (eventType === "acknowledged") return "Observation acknowledged";
  if (eventType === "reopened") return "Observation reopened";
  return `Status changed to ${OBSERVATION_STATUS[status].label.toLowerCase()}`;
}

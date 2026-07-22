"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { fetchObservationSummary } from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import { observationHref, observationTitle, personName } from "../utils";
import { ObservationCard } from "./ObservationCard";
import { ObservationError } from "./ObservationError";

import { ObservationStatusBadge } from "./ObservationStatusBadge";
import { ObservationSummaryCards } from "./ObservationSummaryCards";

export function ObservationOverview() {
  const auth = useAuth();
  const summary = useQuery({
    queryKey: observationKeys.summary(),
    queryFn: fetchObservationSummary,
    enabled: !auth.loading && !!auth.user,
  });
  const role = auth.isAdmin ? "admin" : auth.isManager ? "manager" : auth.isDirector ? "director" : "staff";
  const subtitle = {
    admin: "Monitor observation activity, workflow health, and organisation-wide follow-up.",
    director: "Track organisation-wide progress and records that require follow-up.",
    manager: "Continue drafts, monitor staff acknowledgement, and review recent work.",
    staff: "Review observations shared with you and acknowledge pending results.",
  }[role];
  const pendingStaffItem = summary.data?.needsAttention.find((item) => item.nextAction === "acknowledge");

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />
      <main className="container space-y-8 py-8 lg:py-10">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Observation workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Observations</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/observations/all">View all <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            {(auth.isAdmin || auth.isManager) && (
              <Button asChild><Link href="/observations/new"><Plus className="mr-2 h-4 w-4" />New observation</Link></Button>
            )}
            {role === "staff" && pendingStaffItem && (
              <Button asChild><Link href={observationHref(pendingStaffItem)}><ClipboardCheck className="mr-2 h-4 w-4" />Review pending observation</Link></Button>
            )}
          </div>
        </section>

        {summary.isError && <ObservationError message={summary.error.message} onRetry={() => summary.refetch()} />}
        {(summary.isLoading || auth.loading) && <OverviewSkeleton />}
        {summary.data && (
          <>
            <ObservationSummaryCards counts={summary.data.counts} role={role} />
            <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.6fr)]">
              <Card className="min-w-0 border-border/60 bg-card/80">
                <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-xl">{role === "director" ? "Requires follow-up" : "Needs attention"}</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">The highest-priority records in your current role.</p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="shrink-0 self-start"><Link href="/observations/all?actionRequired=true">See queue</Link></Button>
                </CardHeader>
                <CardContent>
                  {summary.data.needsAttention.length > 0 ? (
                    <div className="grid min-w-0 gap-4">{summary.data.needsAttention.map((item) => <ObservationCard key={item.id} item={item} />)}</div>
                  ) : (
                    <EmptyOverview role={role} />
                  )}
                </CardContent>
              </Card>
              <Card className="min-w-0 border-border/60 bg-card/80">
                <CardHeader><CardTitle className="text-xl">Recent observations</CardTitle></CardHeader>
                <CardContent className="min-w-0 space-y-2">
                  {summary.data.recent.length > 0 ? summary.data.recent.map((item) => (
                    <Link key={item.id} href={observationHref(item)} className="flex min-w-0 items-center justify-between gap-4 overflow-hidden rounded-xl border border-border/50 p-4 transition hover:border-primary/40 hover:bg-muted/30">
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{personName(item.staff)}</p><p className="mt-1 truncate text-sm text-muted-foreground">{observationTitle(item)}</p></div>
                      <ObservationStatusBadge status={item.status} />
                    </Link>
                  )) : <p className="py-8 text-center text-sm text-muted-foreground">No recent observations yet.</p>}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function OverviewSkeleton() {
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div><div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.6fr)]"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div></div>;
}

function EmptyOverview({ role }: { role: "admin" | "director" | "manager" | "staff" }) {
  const copy = role === "manager" ? "Nothing needs your attention. Start a new observation when your next review is ready." : role === "staff" ? "You have no pending acknowledgements. New manager-submitted observations will appear here." : "There are no overdue or unassigned observations requiring follow-up.";
  return <div className="rounded-xl border border-dashed p-8 text-center"><ClipboardCheck className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-4 font-medium">You’re all caught up</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{copy}</p>{(role === "admin" || role === "manager") && <Button asChild variant="outline" className="mt-5"><Link href="/observations/new">New observation</Link></Button>}</div>;
}

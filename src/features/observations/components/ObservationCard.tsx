import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ObservationListItem } from "../types";
import {
  formatObservationDate,
  observationActionLabel,
  observationHref,
  observationTitle,
  personName,
} from "../utils";
import { ObservationProgress } from "./ObservationProgress";
import { ObservationStatusBadge } from "./ObservationStatusBadge";

export function ObservationCard({ item }: { item: ObservationListItem }) {
  const href = observationHref(item);
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardContent className="min-w-0 p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold">{personName(item.staff)}</p>
            <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
              {observationTitle(item)}
            </p>
          </div>
          <div className="shrink-0 self-start"><ObservationStatusBadge status={item.status} /></div>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">Manager: {personName(item.manager)}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">Due {formatObservationDate(item.dueAt)}</span>
            {item.isOverdue && (
              <span className="inline-flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Overdue
              </span>
            )}
          </div>
          <ObservationProgress item={item} />
        </div>
        <Button asChild className="mt-5 w-full justify-between">
          <Link href={href}>
            {observationActionLabel(item)}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

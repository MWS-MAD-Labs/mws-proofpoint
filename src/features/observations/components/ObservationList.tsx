import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ObservationListResponse } from "../types";
import {
  formatExactDate,
  formatObservationDate,
  formatRelativeDate,
  observationActionLabel,
  observationHref,
  observationTitle,
  personName,
} from "../utils";
import { ObservationCard } from "./ObservationCard";
import { ObservationProgress } from "./ObservationProgress";
import { ObservationStatusBadge } from "./ObservationStatusBadge";

export function ObservationList({ result }: { result: ObservationListResponse }) {
  if (result.data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-60 flex-col items-center justify-center p-8 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">No observations found</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Try clearing one or more filters, or return later when observation records are available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:hidden">
        {result.data.map((item) => <ObservationCard key={item.id} item={item} />)}
      </div>
      <Card className="hidden overflow-hidden border-border/60 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Staff</TableHead>
              <TableHead>Observation</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Observation date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((item) => {
              const href = observationHref(item);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={href} className="font-medium hover:text-primary hover:underline">{personName(item.staff)}</Link>
                    <p className="mt-1 text-xs text-muted-foreground">{item.department?.name || "No department"}</p>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <p className="truncate font-medium">{observationTitle(item)}</p>
                    {item.title && <p className="mt-1 truncate text-xs text-muted-foreground">{item.rubric.name}</p>}
                  </TableCell>
                  <TableCell>{personName(item.manager)}</TableCell>
                  <TableCell><ObservationStatusBadge status={item.status} /></TableCell>
                  <TableCell><ObservationProgress item={item} /></TableCell>
                  <TableCell>{formatObservationDate(item.observationDate)}</TableCell>
                  <TableCell>
                    <div className={item.isOverdue ? "text-destructive" : undefined}>{formatObservationDate(item.dueAt)}</div>
                    {item.isOverdue && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="h-3 w-3" /> Overdue</span>}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="text-left text-sm underline-offset-4 hover:underline">{formatRelativeDate(item.updatedAt)}</TooltipTrigger>
                      <TooltipContent>{formatExactDate(item.updatedAt)}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant={item.nextAction === "view" ? "outline" : "default"} className="gap-1.5">
                      <Link href={href}>{observationActionLabel(item)}<ArrowRight className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

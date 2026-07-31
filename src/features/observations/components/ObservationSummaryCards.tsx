import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, ClipboardList, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ObservationSummaryCounts } from "../types";

type RoleView = "admin" | "director" | "manager" | "staff";

interface SummaryCard {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone: string;
}

export function ObservationSummaryCards({ counts, role }: { counts: ObservationSummaryCounts; role: RoleView }) {
  const warningCount = counts.overdue + counts.stale;
  const active = counts.draft + counts.awaitingAcknowledgement;
  const cards: SummaryCard[] =
    role === "staff"
      ? [
          { label: "Needs acknowledgement", value: counts.actionRequired, href: "/observations/all?actionRequired=true", icon: Clock3, tone: "text-primary" },
          { label: "In progress", value: counts.draft, href: "/observations/all?status=draft", icon: ClipboardList, tone: "text-warning-foreground" },
          { label: "Completed", value: counts.completed, href: "/observations/all?status=acknowledged", icon: CheckCircle2, tone: "text-success" },
          { label: "Overdue or stale", value: warningCount, href: "/observations/all?overdue=true", icon: AlertTriangle, tone: "text-destructive" },
        ]
      : role === "manager"
        ? [
            { label: "Drafts in progress", value: counts.draft, href: "/observations/all?managerId=me&status=draft", icon: ClipboardList, tone: "text-warning-foreground" },
            { label: "Awaiting acknowledgement", value: counts.awaitingAcknowledgement, href: "/observations/all?managerId=me&status=submitted", icon: Clock3, tone: "text-primary" },
            { label: "Completed this month", value: counts.completedThisMonth, href: "/observations/all?managerId=me&status=acknowledged", icon: CheckCircle2, tone: "text-success" },
            { label: "Overdue or stale", value: warningCount, href: "/observations/all?managerId=me&overdue=true", icon: AlertTriangle, tone: "text-destructive" },
          ]
        : [
            { label: "Total active", value: active, href: "/observations/all", icon: ClipboardList, tone: "text-primary" },
            { label: "Awaiting acknowledgement", value: counts.awaitingAcknowledgement, href: "/observations/all?status=submitted", icon: Clock3, tone: "text-primary" },
            { label: "Completed this month", value: counts.completedThisMonth, href: "/observations/all?status=acknowledged", icon: CheckCircle2, tone: "text-success" },
            { label: "Overdue or stale", value: warningCount, href: "/observations/all?overdue=true", icon: AlertTriangle, tone: "text-destructive" },
          ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.label} href={card.href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full border-border/60 bg-card/80 transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <card.icon className={`h-5 w-5 ${card.tone}`} aria-hidden="true" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

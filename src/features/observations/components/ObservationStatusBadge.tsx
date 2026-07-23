import { CheckCircle2, Clock3, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OBSERVATION_STATUS } from "../constants";
import type { ObservationStatus } from "../types";

const icons = {
  draft: PencilLine,
  submitted: Clock3,
  acknowledged: CheckCircle2,
} as const;

export function ObservationStatusBadge({ status }: { status: ObservationStatus }) {
  const metadata = OBSERVATION_STATUS[status];
  const Icon = icons[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap", metadata.className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {metadata.label}
    </Badge>
  );
}

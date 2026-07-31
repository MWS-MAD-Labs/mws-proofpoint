import { Progress } from "@/components/ui/progress";
import type { ObservationListItem } from "../types";
import { statusStage } from "../utils";

export function ObservationProgress({ item }: { item: ObservationListItem }) {
  if (!item.progress) {
    return <span className="text-sm text-muted-foreground">{statusStage(item.status)}</span>;
  }
  if (item.status !== "draft") {
    return <span className="text-sm font-medium text-success dark:text-success">Complete</span>;
  }
  return (
    <div className="min-w-28 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {item.progress.requiredAnswered}/{item.progress.requiredTotal} required
        </span>
        <span className="font-medium">{item.progress.percentage}%</span>
      </div>
      <Progress value={item.progress.percentage} className="h-1.5" />
    </div>
  );
}

import { CheckCircle2, Clock3, PencilLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OBSERVATION_STATUS } from "../constants";
import type { ObservationSummaryResponse } from "../types";

const icons = { draft: PencilLine, submitted: Clock3, acknowledged: CheckCircle2 } as const;

export function ObservationPipeline({ pipeline }: Pick<ObservationSummaryResponse, "pipeline">) {
  const total = pipeline.reduce((sum, item) => sum + item.count, 0);
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Observation pipeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {pipeline.map((item) => {
          const Icon = icons[item.status];
          const percentage = total === 0 ? 0 : Math.round((item.count / total) * 100);
          return (
            <div key={item.status} className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">{percentage}%</span>
              </div>
              <p className="mt-4 text-2xl font-semibold">{item.count}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {OBSERVATION_STATUS[item.status].label}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

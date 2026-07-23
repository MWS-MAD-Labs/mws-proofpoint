import { Suspense } from "react";
import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicGoalDetailPage({
  params,
}: {
  params: Promise<{ planId: string; goalId: string }>;
}) {
  const { planId, goalId } = await params;
  return (
    <Suspense fallback={null}>
      <StrategicPlansClient
        mode="detail"
        planId={planId}
        initialSelected={{ type: "goal", id: goalId }}
      />
    </Suspense>
  );
}

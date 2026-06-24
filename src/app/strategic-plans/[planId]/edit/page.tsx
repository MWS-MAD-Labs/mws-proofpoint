import { Suspense } from "react";
import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicPlanEditPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  return (
    <Suspense fallback={null}>
      <StrategicPlansClient mode="edit" planId={planId} />
    </Suspense>
  );
}

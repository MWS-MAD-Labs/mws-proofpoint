import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicPlanBudgetPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <StrategicPlansClient mode="budget" planId={planId} />;
}

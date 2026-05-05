import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicGoalDetailPage({ params }: { params: Promise<{ planId: string; goalId: string }> }) {
  const { planId } = await params;
  return <StrategicPlansClient mode="detail" planId={planId} />;
}

import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicPlanEditPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <StrategicPlansClient mode="edit" planId={planId} />;
}

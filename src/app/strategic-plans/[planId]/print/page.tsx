import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicPlanPrintPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <StrategicPlansClient mode="print" planId={planId} />;
}

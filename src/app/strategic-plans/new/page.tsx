import { Suspense } from "react";
import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default function NewStrategicPlanPage() {
  return (
    <Suspense fallback={null}>
      <StrategicPlansClient mode="new" />
    </Suspense>
  );
}

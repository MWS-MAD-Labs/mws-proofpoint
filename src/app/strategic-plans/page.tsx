import { Suspense } from "react";
import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default function StrategicPlansPage() {
  return (
    <Suspense fallback={null}>
      <StrategicPlansClient mode="list" />
    </Suspense>
  );
}

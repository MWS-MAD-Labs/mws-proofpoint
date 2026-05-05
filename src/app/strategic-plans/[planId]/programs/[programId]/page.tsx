import { Suspense } from "react";
import { StrategicPlansClient } from "@/components/strategic-plans/StrategicPlansClient";

export default async function StrategicProgramDetailPage({
  params,
}: {
  params: Promise<{ planId: string; programId: string }>;
}) {
  const { planId, programId } = await params;
  return (
    <Suspense fallback={null}>
      <StrategicPlansClient
        mode="edit"
        planId={planId}
        initialSelected={{ type: "program", id: programId }}
      />
    </Suspense>
  );
}

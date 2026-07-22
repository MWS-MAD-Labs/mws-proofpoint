"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchObservationDetail } from "@/features/observations/api/queries";
import { observationKeys } from "@/features/observations/api/queryKeys";
import { ObservationDetailReport } from "@/features/observations/components/ObservationDetailReport";
import { ObservationError } from "@/features/observations/components/ObservationError";

export default function ObservationDetailPage() {
  const params = useParams<{ observationId: string }>();
  const detail = useQuery({
    queryKey: observationKeys.detail(params.observationId),
    queryFn: () => fetchObservationDetail(params.observationId),
  });

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />
      <main className="container space-y-6 py-8 lg:py-10">
        {detail.isError && (
          <ObservationError
            message={detail.error.message}
            onRetry={() => detail.refetch()}
          />
        )}
        {detail.isLoading && <ObservationDetailSkeleton />}
        {detail.data && <ObservationDetailReport detail={detail.data} />}
      </main>
    </div>
  );
}

function ObservationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

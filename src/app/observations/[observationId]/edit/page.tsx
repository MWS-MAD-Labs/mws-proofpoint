"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchObservationDetail } from "@/features/observations/api/queries";
import { observationKeys } from "@/features/observations/api/queryKeys";
import { ObservationError } from "@/features/observations/components/ObservationError";
import { ObservationFormEditor } from "@/features/observations/components/ObservationFormEditor";

export default function ObservationEditPage() {
  const params = useParams<{ observationId: string }>();
  const detail = useQuery({
    queryKey: observationKeys.detail(params.observationId),
    queryFn: () => fetchObservationDetail(params.observationId),
  });

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />
      <div className="container space-y-6 py-6 lg:py-8">
        {detail.isError && (
          <ObservationError
            message={detail.error.message}
            onRetry={() => detail.refetch()}
          />
        )}
        {detail.isLoading && <ObservationEditorSkeleton />}
        {detail.data && <ObservationFormEditor detail={detail.data} />}
      </div>
    </div>
  );
}

function ObservationEditorSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <Skeleton className="hidden h-80 rounded-xl lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="hidden h-72 rounded-xl lg:block" />
      </div>
    </div>
  );
}

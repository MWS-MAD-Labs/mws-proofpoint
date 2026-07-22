"use client";

import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { fetchObservationFilterOptions, fetchObservationList } from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import { useObservationFilters } from "../hooks/useObservationFilters";
import { ObservationError } from "./ObservationError";
import { ObservationFilters } from "./ObservationFilters";
import { ObservationList } from "./ObservationList";
import { ObservationListSkeleton } from "./ObservationListSkeleton";
import { ObservationPagination } from "./ObservationPagination";

export function ObservationListPage() {
  const auth = useAuth();
  const { filters, updateFilters, clearFilters } = useObservationFilters(auth.roles, auth.loading);
  const showOrganisationFilters = auth.isAdmin || auth.isDirector;
  const list = useQuery({ queryKey: observationKeys.list(filters), queryFn: () => fetchObservationList(filters), enabled: !auth.loading && !!auth.user });
  const options = useQuery({
    queryKey: [...observationKeys.filterOptions(), showOrganisationFilters],
    queryFn: () => fetchObservationFilterOptions(showOrganisationFilters, showOrganisationFilters),
    enabled: !auth.loading && !!auth.user,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />
      <main className="container space-y-6 py-8 lg:py-10">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3"><Link href="/observations"><ArrowLeft className="mr-2 h-4 w-4" />Overview</Link></Button>
            <h1 className="text-3xl font-semibold tracking-tight">All observations</h1>
            <p className="mt-2 text-muted-foreground">Search, filter, and open observation records. This URL can be shared or bookmarked.</p>
          </div>
          {(auth.isAdmin || auth.isManager) && <Button asChild><Link href="/observations/new"><Plus className="mr-2 h-4 w-4" />New observation</Link></Button>}
        </section>

        <ObservationFilters filters={filters} options={options.data ?? { departments: [], managers: [], rubrics: [] }} showDepartment={showOrganisationFilters} showManager={showOrganisationFilters} onChange={updateFilters} onClear={clearFilters} />
        {options.isError && <p className="text-sm text-destructive">Some filter options could not be loaded. List filtering by status, dates, or action remains available.</p>}
        {list.isError && <ObservationError message={list.error.message} onRetry={() => list.refetch()} />}
        {list.isLoading && <ObservationListSkeleton />}
        {list.data && <><ObservationList result={list.data} /><ObservationPagination pagination={list.data.pagination} onPageChange={(page) => updateFilters({ page })} onPageSizeChange={(pageSize) => updateFilters({ pageSize, page: 1 })} /></>}
      </main>
    </div>
  );
}

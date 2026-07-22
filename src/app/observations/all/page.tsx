import { Suspense } from "react";
import { ObservationListPage } from "@/features/observations/components/ObservationListPage";
import { ObservationListSkeleton } from "@/features/observations/components/ObservationListSkeleton";

export default function AllObservationsPage() {
  return <Suspense fallback={<div className="container py-10"><ObservationListSkeleton /></div>}><ObservationListPage /></Suspense>;
}

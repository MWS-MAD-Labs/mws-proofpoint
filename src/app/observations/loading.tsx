import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ObservationsLoading() {
  return <div className="min-h-screen bg-background"><Header /><main className="container space-y-6 py-10"><Skeleton className="h-10 w-64" /><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-96 w-full rounded-xl" /></main></div>;
}

"use client";

import { Header } from "@/components/layout/Header";
import { ObservationError } from "@/features/observations/components/ObservationError";

export default function ObservationsError({ error, reset }: { error: Error; reset: () => void }) {
  return <div className="min-h-screen bg-background"><Header /><main className="container py-10"><ObservationError message={error.message} onRetry={reset} /></main></div>;
}

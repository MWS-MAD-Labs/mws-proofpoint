import { Header } from "@/components/layout/Header";
import { ObservationCreationWizard } from "@/features/observations/components/ObservationCreationWizard";

export default function NewObservationPage() {
  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />
      <main className="container py-6 lg:py-8">
        <ObservationCreationWizard />
      </main>
    </div>
  );
}

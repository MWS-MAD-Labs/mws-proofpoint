// src/app/rubrics/page.tsx
// Milestone 4 change: Observation Form editor moved into this Rubrics menu
// as a separate tab (alongside KPI/Appraisal rubrics).
//
// This file only shows the ADDITIONS needed in the existing rubrics/page.tsx.
// In the actual file:
//   1. Add "Observation Forms" tab to the existing tab layout.
//   2. Import and render <ObservationFormEditor /> inside that tab.
//
// PATCH INSTRUCTIONS for rubrics/page.tsx:
//
// Step 1 — Add import at the top:
//   import { ObservationFormEditor } from "@/components/admin/ObservationFormEditor";
//
// Step 2 — Add tab state. Find the existing tab state (e.g. activeTab) and add:
//   type TabType = 'kpi' | 'observation-forms';
//   const [activeTab, setActiveTab] = useState<TabType>('kpi');
//
// Step 3 — Add tab switcher UI before the rubric list, e.g.:
//
//   <div className="flex gap-2 mb-6">
//     <Button
//       variant={activeTab === 'kpi' ? 'default' : 'outline'}
//       onClick={() => setActiveTab('kpi')}
//       size="sm"
//       className="gap-2"
//     >
//       <FileText className="w-4 h-4" />
//       KPI / Appraisal Rubrics
//     </Button>
//     {(isAdmin || isManager) && (
//       <Button
//         variant={activeTab === 'observation-forms' ? 'default' : 'outline'}
//         onClick={() => setActiveTab('observation-forms')}
//         size="sm"
//         className="gap-2"
//       >
//         <ClipboardCheck className="w-4 h-4" />
//         Observation Forms
//       </Button>
//     )}
//   </div>
//
// Step 4 — Wrap existing rubric list in:
//   {activeTab === 'kpi' && ( ... existing rubric content ... )}
//   {activeTab === 'observation-forms' && <ObservationFormEditor />}
//
// The ObservationFormEditor component (already built in M3) handles
// all CRUD for CLASSROOM_OBSERVATION templates.
//
// ──────────────────────────────────────────────────────────────────────────────
// Full standalone file below. Replace src/app/rubrics/page.tsx with this.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { FileText, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ObservationFormEditor } from "@/components/admin/ObservationFormEditor";

// Lazy-import the heavy KPI rubric content to keep bundle small
import dynamic from "next/dynamic";
const KpiRubricsContent = dynamic(() => import("@/components/rubrics/KpiRubricsContent"), {
  loading: () => (
    <div className="flex items-center justify-center py-24">
      <span className="text-muted-foreground text-sm">Loading rubrics...</span>
    </div>
  ),
  ssr: false,
});

type TabType = "kpi" | "observation-forms";

function RubricsPageContent() {
  const { isAdmin, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("kpi");

  const canSeeObsForms = isAdmin || isManager;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-8 max-w-7xl">

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Rubrics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage KPI appraisal rubrics and observation forms
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 border-b border-border/50 pb-4">
          <Button
            variant={activeTab === "kpi" ? "default" : "outline"}
            onClick={() => setActiveTab("kpi")}
            size="sm"
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            KPI / Appraisal Rubrics
          </Button>

          {canSeeObsForms && (
            <Button
              variant={activeTab === "observation-forms" ? "default" : "outline"}
              onClick={() => setActiveTab("observation-forms")}
              size="sm"
              className="gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Observation Forms
            </Button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "kpi" && (
          <Suspense>
            <KpiRubricsContent />
          </Suspense>
        )}

        {activeTab === "observation-forms" && canSeeObsForms && (
          <ObservationFormEditor />
        )}

      </main>
    </div>
  );
}

export default function RubricsPage() {
  return (
    <ProtectedRoute>
      <RubricsPageContent />
    </ProtectedRoute>
  );
}

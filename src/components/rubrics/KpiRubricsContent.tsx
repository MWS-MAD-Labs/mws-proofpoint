// src/components/rubrics/KpiRubricsContent.tsx
//
// This file extracts the existing KPI/Appraisal rubric list content
// from src/app/rubrics/page.tsx so the rubrics page can have tabs.
//
// MIGRATION STEP:
//   1. Take all the existing JSX inside the <ProtectedRoute> of rubrics/page.tsx
//      (excluding the Header and outer wrapper).
//   2. Paste it into this component.
//   3. The new rubrics/page.tsx calls this component in the "kpi" tab.
//
// IMPORTANT: This file is a placeholder / guide.
// The actual content is the existing rubrics page body — copy it here.
//
// Minimal stub that satisfies the import until the full migration is done:

"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function KpiRubricsContent() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Simulate async load of existing rubric content
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // TODO: Paste the existing KPI rubric list content from rubrics/page.tsx here.
  // This stub is replaced by the full implementation in the actual codebase.
  return (
    <div className="text-muted-foreground text-sm py-8 text-center">
      {/* The existing KPI rubric list goes here */}
      KPI Rubric list (copy existing rubrics/page.tsx content here)
    </div>
  );
}

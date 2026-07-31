import { cn } from "@/lib/utils";
import {
  Info,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Award,
} from "lucide-react";

interface ScoreOption {
  score: number | "X";
  label: string;
  description?: string;
}

interface ScoreSelectorProps {
  value: number | "X" | null;
  onChange: (score: number | "X") => void;
  disabled?: boolean;
  rubricDescriptions?: {
    1: string;
    2: string;
    3: string;
    4: string;
  };
  hideEvidenceRequirement?: boolean;
  hideNotImplemented?: boolean;
}

const getScoreConfig = (score: number | "X") => {
  if (score === "X") {
    return {
      bg: "bg-slate-500",
      border: "border-slate-500",
      text: "text-white",
      glow: "shadow-[0_0_20px_rgba(100,116,139,0.4)]",
      icon: Info,
      gradient: "from-slate-500/20 to-slate-400/20",
    };
  }

  switch (score) {
    case 1:
      return {
        bg: "bg-score-1",
        border: "border-score-1",
        text: "text-white",
        glow: "shadow-[0_0_20px_hsl(var(--score-1)/0.4)]",
        icon: AlertTriangle,
        gradient: "from-orange-500/20 to-amber-500/20",
      };
    case 2:
      return {
        bg: "bg-score-2",
        border: "border-score-2",
        text: "text-white",
        glow: "shadow-[0_0_20px_hsl(var(--score-2)/0.4)]",
        icon: CheckCircle,
        gradient: "from-amber-500/20 to-yellow-500/20",
      };
    case 3:
      return {
        bg: "bg-score-3",
        border: "border-score-3",
        text: "text-white",
        glow: "shadow-[0_0_20px_hsl(var(--score-3)/0.4)]",
        icon: TrendingUp,
        gradient: "from-emerald-500/20 to-green-500/20",
      };
    case 4:
      return {
        bg: "bg-score-4",
        border: "border-score-4",
        text: "text-white",
        glow: "shadow-[0_0_25px_hsl(var(--score-4)/0.5)]",
        icon: Award,
        gradient: "from-blue-500/20 to-cyan-500/20",
      };
    default:
      return {
        bg: "bg-muted",
        border: "border-border",
        text: "text-foreground",
        glow: "",
        icon: Info,
        gradient: "from-muted to-muted",
      };
  }
};

export function ScoreSelector({
  value,
  onChange,
  disabled,
  rubricDescriptions,
  hideEvidenceRequirement,
  hideNotImplemented,
}: ScoreSelectorProps) {
  const allOptions: ScoreOption[] = [
    { score: 1, label: "Beginning", description: rubricDescriptions?.[1] },
    { score: 2, label: "Developing", description: rubricDescriptions?.[2] },
    { score: 3, label: "Proficient", description: rubricDescriptions?.[3] },
    { score: 4, label: "Exemplary", description: rubricDescriptions?.[4] },
    {
      score: "X",
      label: "Not Implemented Yet",
      description:
        "This KPI is not yet active or applicable for this period. It will not be factored into the final score.",
    },
  ];



  const selectedScore = typeof value === "number" ? value : null;
  const selectedOption = selectedScore === null
    ? undefined
    : allOptions.find((option) => option.score === Math.round(selectedScore));
  const selectedConfig = selectedOption ? getScoreConfig(selectedOption.score) : null;
  const scoreColor =
    selectedScore === null ? "accent-primary" :
    selectedScore < 2 ? "accent-red-500" :
    selectedScore < 3 ? "accent-amber-500" :
    selectedScore < 4 ? "accent-emerald-500" : "accent-blue-500";
  const selectedDotColor =
    selectedScore === null ? "bg-primary text-primary-foreground border-primary" :
    selectedScore < 2 ? "bg-red-500 text-white border-red-600" :
    selectedScore < 3 ? "bg-amber-500 text-white border-amber-600" :
    selectedScore < 4 ? "bg-emerald-500 text-white border-emerald-600" : "bg-blue-500 text-white border-blue-600";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">Performance rating</span>
          <output className="rounded-md bg-primary px-3 py-1 font-mono text-lg font-bold text-primary-foreground">
            {selectedScore?.toFixed(1) ?? "—"}
          </output>
        </div>
        <div className="relative h-9">
          <input
            aria-label="Performance rating from 1 to 4"
            type="range"
            min={1}
            max={4}
            step={0.1}
            value={selectedScore ?? 1}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className={cn("absolute inset-x-0 top-1/2 z-10 h-2 w-full -translate-y-1/2 cursor-pointer disabled:cursor-not-allowed", scoreColor)}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-between px-0.5">
            {[1, 2, 3, 4].map((score) => (
              <span key={score} className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-md", Math.round(selectedScore ?? 0) === score ? selectedDotColor : "border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300")}>
                {score}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
          {allOptions.slice(0, 4).map((option, index) => (
            <div key={option.score} className={cn(index === 0 ? "text-left" : index === 3 ? "text-right" : "text-center")}>
              <p className="font-semibold text-foreground">{option.score} · {option.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{option.description || "No rubric description provided."}</p>
            </div>
          ))}
        </div>
        {!hideNotImplemented && (
          <button
            type="button"
            onClick={() => onChange("X")}
            disabled={disabled}
            className={cn(
              "mt-4 rounded-md border px-3 py-1.5 text-sm transition-colors",
              value === "X" ? "border-slate-500 bg-slate-500 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            Not Implemented Yet
          </button>
        )}
      </div>

      {/* Selected Score Info Card */}
      {selectedOption && selectedConfig && (
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border p-4 transition-all duration-300",
            selectedOption.score === "X" && "bg-slate-50 border-slate-200",
            selectedOption.score === 1 &&
              "bg-evidence-alert-bg border-evidence-alert-border",
            selectedOption.score === 2 && "bg-muted/50 border-border",
            typeof selectedOption.score === "number" &&
              selectedOption.score >= 3 &&
              "bg-evidence-success-bg border-evidence-success-border",
          )}
        >
          {/* Gradient Overlay */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-r opacity-30 pointer-events-none",
              selectedConfig.gradient,
            )}
          />

          <div className="relative flex items-start gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                selectedOption.score === "X" && "bg-slate-500 text-white",
                selectedOption.score === 1 &&
                  "bg-evidence-alert/10 text-evidence-alert",
                selectedOption.score === 2 && "bg-muted text-muted-foreground",
                typeof selectedOption.score === "number" &&
                  selectedOption.score >= 3 &&
                  "bg-evidence-success/10 text-evidence-success",
              )}
            >
              {selectedOption.score === "X" ? (
                <span className="text-xl font-mono font-bold">X</span>
              ) : (
                <selectedConfig.icon className="h-6 w-6" />
              )}
            </div>
            <div>
              <p
                className={cn(
                  "font-bold text-base",
                  selectedOption.score === "X" && "text-slate-700",
                  selectedOption.score === 1 && "text-evidence-alert",
                  selectedOption.score === 2 && "text-foreground",
                  typeof selectedOption.score === "number" &&
                    selectedOption.score >= 3 &&
                    "text-evidence-success",
                )}
              >
                {selectedOption.score === "X"
                  ? "Not Implemented Yet"
                  : `${selectedScore?.toFixed(1)} · ${selectedOption.label}`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedOption.description}
              </p>
              {!hideEvidenceRequirement && selectedOption.score !== "X" && (
                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground border-t pt-2">
                  <Info className="h-3.5 w-3.5" />
                  Evidence required to support this rating
                </div>
              )}
              {selectedOption.score === "X" && (
                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 border-t border-slate-200 pt-2">
                  <Info className="h-3.5 w-3.5" />
                  Will be excluded from total score calculation
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

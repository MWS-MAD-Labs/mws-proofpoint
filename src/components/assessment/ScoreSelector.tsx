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
  compact?: boolean;
}

const getScoreConfig = (score: number | "X") => {
  if (score === "X") {
    return {
      bg: "bg-foreground",
      border: "border-border",
      text: "text-white",
      glow: "shadow-[0_0_20px_rgba(100,116,139,0.4)]",
      icon: Info,
      gradient: "from-muted/20 to-muted/20",
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
        gradient: "from-warning/20 to-warning/20",
      };
    case 2:
      return {
        bg: "bg-score-2",
        border: "border-score-2",
        text: "text-white",
        glow: "shadow-[0_0_20px_hsl(var(--score-2)/0.4)]",
        icon: CheckCircle,
        gradient: "from-warning/20 to-warning/20",
      };
    case 3:
      return {
        bg: "bg-score-3",
        border: "border-score-3",
        text: "text-white",
        glow: "shadow-[0_0_20px_hsl(var(--score-3)/0.4)]",
        icon: TrendingUp,
        gradient: "from-success/20 to-success/20",
      };
    case 4:
      return {
        bg: "bg-score-4",
        border: "border-score-4",
        text: "text-white",
        glow: "shadow-[0_0_25px_hsl(var(--score-4)/0.5)]",
        icon: Award,
        gradient: "from-primary/20 to-info/20",
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
  compact = false,
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
    selectedScore < 2 ? "bg-destructive text-white border-destructive/40" :
    selectedScore < 3 ? "bg-warning text-white border-warning/40" :
    selectedScore < 4 ? "bg-success text-white border-success/40" : "bg-primary text-white border-primary/40";

  if (compact) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <input
            aria-label="Performance rating from 1 to 4"
            type="range"
            min={1}
            max={4}
            step={0.1}
            value={selectedScore ?? 1}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className={cn("h-2 min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed", scoreColor)}
          />
          <output className="min-w-12 rounded-md bg-primary px-2.5 py-1 text-center font-mono text-base font-bold text-primary-foreground">
            {selectedScore?.toFixed(1) ?? "—"}
          </output>
          {!hideNotImplemented && (
            <button
              type="button"
              onClick={() => onChange("X")}
              disabled={disabled}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                value === "X" ? "border-border bg-foreground text-white" : "border-border text-muted-foreground hover:bg-muted",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              N/A
            </button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] leading-4 text-muted-foreground">
          {allOptions.slice(0, 4).map((option, index) => (
            <span key={option.score} className={cn("min-w-0", index === 0 ? "text-left" : index === 3 ? "text-right" : "text-center")}>
              <span className="font-semibold text-foreground">{option.score}</span>
              <span className="block">{option.description || option.label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

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
              <span key={score} className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-md", Math.round(selectedScore ?? 0) === score ? selectedDotColor : "border-border bg-white text-muted-foreground dark:border-border dark:bg-foreground dark:text-muted-foreground")}>
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
              value === "X" ? "border-border bg-foreground text-white" : "border-border text-muted-foreground hover:bg-card",
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
            selectedOption.score === "X" && "bg-card border-border",
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
                selectedOption.score === "X" && "bg-foreground text-white",
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
                  selectedOption.score === "X" && "text-foreground",
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
                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground border-t border-border pt-2">
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

import { cn } from "@/lib/utils";
import { Info, Sparkles, AlertTriangle, CheckCircle, TrendingUp, Award } from "lucide-react";

interface ScoreOption {
  score: number | 'X';
  label: string;
  description?: string;
}

interface ScoreSelectorProps {
  value: number | 'X' | null;
  onChange: (score: number | 'X') => void;
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

const getScoreConfig = (score: number | 'X') => {
  if (score === 'X') {
    return {
      bg: 'bg-slate-500',
      border: 'border-slate-500',
      text: 'text-white',
      glow: 'shadow-[0_0_20px_rgba(100,116,139,0.4)]',
      icon: Info,
      gradient: 'from-slate-500/20 to-slate-400/20'
    };
  }

  switch (score) {
    case 1:
      return {
        bg: 'bg-score-1',
        border: 'border-score-1',
        text: 'text-white',
        glow: 'shadow-[0_0_20px_hsl(var(--score-1)/0.4)]',
        icon: AlertTriangle,
        gradient: 'from-orange-500/20 to-amber-500/20'
      };
    case 2:
      return {
        bg: 'bg-score-2',
        border: 'border-score-2',
        text: 'text-white',
        glow: 'shadow-[0_0_20px_hsl(var(--score-2)/0.4)]',
        icon: CheckCircle,
        gradient: 'from-amber-500/20 to-yellow-500/20'
      };
    case 3:
      return {
        bg: 'bg-score-3',
        border: 'border-score-3',
        text: 'text-white',
        glow: 'shadow-[0_0_20px_hsl(var(--score-3)/0.4)]',
        icon: TrendingUp,
        gradient: 'from-emerald-500/20 to-green-500/20'
      };
    case 4:
      return {
        bg: 'bg-score-4',
        border: 'border-score-4',
        text: 'text-white',
        glow: 'shadow-[0_0_25px_hsl(var(--score-4)/0.5)]',
        icon: Award,
        gradient: 'from-blue-500/20 to-cyan-500/20'
      };
    default:
      return {
        bg: 'bg-muted',
        border: 'border-border',
        text: 'text-foreground',
        glow: '',
        icon: Info,
        gradient: 'from-muted to-muted'
      };
  }
};

export function ScoreSelector({ value, onChange, disabled, rubricDescriptions, hideEvidenceRequirement, hideNotImplemented }: ScoreSelectorProps) {
  const allOptions: ScoreOption[] = [
    { score: 1, label: "Beginning", description: rubricDescriptions?.[1] },
    { score: 2, label: "Developing", description: rubricDescriptions?.[2] },
    { score: 3, label: "Proficient", description: rubricDescriptions?.[3] },
    { score: 4, label: "Exemplary", description: rubricDescriptions?.[4] },
    { score: 'X', label: "Not Implemented Yet", description: "This KPI is not yet active or applicable for this period. It will not be factored into the final score." },
  ];

  const options = hideNotImplemented ? allOptions.filter(o => o.score !== 'X') : allOptions;

  const selectedOption = options.find(o => o.score === value);
  const selectedConfig = selectedOption ? getScoreConfig(selectedOption.score) : null;

  return (
    <div className="space-y-4">
      {/* Score Buttons */}
      <div className="flex gap-3 flex-wrap items-center">
        {options.map((option) => {
          const isSelected = value === option.score;
          const config = getScoreConfig(option.score);
          const isX = option.score === 'X';

          return (
            <button
              key={option.score}
              type="button"
              onClick={() => onChange(option.score)}
              disabled={disabled}
              className={cn(
                "relative group transition-all duration-300",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              {/* Glow Effect */}
              {isSelected && (
                <div className={cn(
                  "absolute inset-0 rounded-xl blur-lg opacity-60 transition-opacity",
                  config.bg
                )} />
              )}

              {/* Button */}
              <div
                className={cn(
                  "relative w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center font-mono font-bold transition-all duration-300",
                  isSelected
                    ? cn(config.bg, config.border, config.text, config.glow, "scale-110")
                    : isX
                      ? "bg-slate-100 border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:scale-105"
                      : "bg-card border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground hover:scale-105 hover:shadow-lg",
                  isX ? "text-xl" : "text-lg"
                )}
              >
                {option.score}

                {/* Sparkle for score 4 */}
                {isSelected && option.score === 4 && (
                  <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-300 animate-pulse" />
                )}
              </div>

              {/* Tooltip */}
              {/* Tooltip Removed per user request */}
            </button>
          );
        })}
      </div>

      {/* Selected Score Info Card */}
      {selectedOption && selectedConfig && (
        <div className={cn(
          "relative overflow-hidden rounded-xl border p-4 transition-all duration-300",
          selectedOption.score === 'X' && "bg-slate-50 border-slate-200",
          selectedOption.score === 1 && "bg-evidence-alert-bg border-evidence-alert-border",
          selectedOption.score === 2 && "bg-muted/50 border-border",
          selectedOption.score >= 3 && "bg-evidence-success-bg border-evidence-success-border"
        )}>
          {/* Gradient Overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-r opacity-30 pointer-events-none",
            selectedConfig.gradient
          )} />

          <div className="relative flex items-start gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
              selectedOption.score === 'X' && "bg-slate-500 text-white",
              selectedOption.score === 1 && "bg-evidence-alert/10 text-evidence-alert",
              selectedOption.score === 2 && "bg-muted text-muted-foreground",
              selectedOption.score >= 3 && "bg-evidence-success/10 text-evidence-success"
            )}>
              {selectedOption.score === 'X' ? (
                <span className="text-xl font-mono font-bold">X</span>
              ) : (
                <selectedConfig.icon className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className={cn(
                "font-bold text-base",
                selectedOption.score === 'X' && "text-slate-700",
                selectedOption.score === 1 && "text-evidence-alert",
                selectedOption.score === 2 && "text-foreground",
                selectedOption.score >= 3 && "text-evidence-success"
              )}>
                {selectedOption.score === 'X' ? 'Not Implemented Yet' : selectedOption.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedOption.description}
              </p>
              {!hideEvidenceRequirement && selectedOption.score !== 'X' && (
                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground border-t pt-2">
                  <Info className="h-3.5 w-3.5" />
                  Evidence required to support this rating
                </div>
              )}
              {selectedOption.score === 'X' && (
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

import { cn } from "@/lib/utils";

interface ProofPointMarkProps {
  className?: string;
  iconClassName?: string;
  title?: string;
}

export function ProofPointMark({
  className,
  iconClassName,
  title = "ProofPoint",
}: ProofPointMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      role="img"
      aria-label={title}
    >
      <svg
        className={cn("h-1/2 w-1/2", iconClassName)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    </span>
  );
}

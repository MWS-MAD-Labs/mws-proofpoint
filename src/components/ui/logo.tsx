import { ProofPointMark } from "@/components/ProofPointMark";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
    return (
        <div className={cn("flex items-center gap-3 group", className)}>
            <ProofPointMark className="h-12 w-12 rounded-lg transition-transform duration-200 group-hover:-translate-y-0.5" />

            {showText && (
                <div className="flex flex-col justify-center">
                    <h1 className="mb-1 font-heading text-2xl font-extrabold leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
                        ProofPoint
                    </h1>
                    <p className="font-heading text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-muted-foreground">
                        Command Center
                    </p>
                </div>
            )}
        </div>
    );
}

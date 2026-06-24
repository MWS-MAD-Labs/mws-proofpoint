import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
    return (
        <div className={cn("flex items-center gap-3 group", className)}>
            <div className="relative">
                <div className="absolute inset-0 bg-[#2563eb] rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-[#2563eb] shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    <Activity className="h-6 w-6 text-white" strokeWidth={2.5} />
                </div>
            </div>

            {showText && (
                <div className="flex flex-col justify-center">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none mb-1 group-hover:text-[#2563eb] transition-colors">
                        ProofPoint
                    </h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium leading-none">
                        Command Center
                    </p>
                </div>
            )}
        </div>
    );
}

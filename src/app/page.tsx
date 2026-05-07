'use client';

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Shield, BarChart3, Users, FileCheck, LogIn, Zap, Lock, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
    const router = useRouter();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-background overflow-hidden">
            {/* Hero Section */}
            <div className="relative">
                {/* Layered Background Effects */}
                <div className="absolute inset-0 grid-pattern" />
                <div className="absolute inset-0 mesh-gradient" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

                {/* Floating Orbs */}
                <div className="absolute top-20 right-[20%] w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-20 left-[10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-2s' }} />

                <div className="container relative pt-8 pb-32">
                    {/* Header */}
                    <header className="flex items-center justify-between mb-20">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary rounded-xl blur-lg opacity-50 animate-pulse-glow" />
                                <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-primary glow-primary">
                                    <Activity className="h-6 w-6 text-primary-foreground" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-foreground">ProofPoint</h1>
                                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
                                    Performance Command Center
                                </p>
                            </div>
                        </div>

                        {!user && (
                            <Button
                                variant="outline"
                                onClick={() => router.push("/auth")}
                                className="glass-panel hover:glow-primary transition-all duration-300"
                            >
                                <LogIn className="mr-2 h-4 w-4" />
                                Sign In
                            </Button>
                        )}
                    </header>

                    {/* Hero Content */}
                    <div className="max-w-4xl">
                        {/* Status Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-primary text-sm font-medium mb-8 animate-pulse-glow">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <Shield className="h-4 w-4" />
                            <span>Evidence-Driven Appraisals</span>
                        </div>

                        {/* Main Heading */}
                        <h2 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
                            <span className="text-foreground">No Evidence,</span>
                            <br />
                            <span className="text-gradient-hero">No Score.</span>
                        </h2>

                        {/* Subheading */}
                        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-10 max-w-2xl font-light">
                            ProofPoint revolutionizes employee appraisals with a
                            <span className="text-foreground font-medium"> data-driven approach</span>.
                            Every rating requires documentation. Every score is justified.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            {user ? (
                                <Button
                                    size="lg"
                                    onClick={() => router.push("/dashboard")}
                                    className="text-lg px-8 py-6 glow-primary-strong hover:scale-105 transition-all duration-300"
                                >
                                    <Zap className="mr-2 h-5 w-5" />
                                    Open Dashboard
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        size="lg"
                                        onClick={() => router.push("/auth")}
                                        className="text-lg px-8 py-6 glow-primary-strong hover:scale-105 transition-all duration-300"
                                    >
                                        <Zap className="mr-2 h-5 w-5" />
                                        Get Started
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={() => router.push("/auth")}
                                        className="text-lg px-8 py-6 glass-panel hover:glow-primary hover:border-primary/50 transition-all duration-300"
                                    >
                                        Learn More
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Stats Row */}
                        <div className="flex flex-wrap gap-8 mt-16 pt-8 border-t border-border/50">
                            {[
                                { value: "100%", label: "Evidence Coverage" },
                                { value: "4-Step", label: "Approval Flow" },
                                { value: "Real-time", label: "Score Calculation" },
                            ].map((stat, i) => (
                                <div key={i} className="text-center">
                                    <div className="text-3xl font-bold text-primary font-mono">{stat.value}</div>
                                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="relative border-t border-border/50">
                <div className="absolute inset-0 grid-pattern opacity-50" />

                <div className="container relative py-24">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider mb-4">
                            <TrendingUp className="h-3 w-3" />
                            Command Center
                        </div>
                        <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                            Enterprise-Grade Performance
                        </h3>
                        <p className="text-muted-foreground max-w-xl mx-auto">
                            Built for organizations that demand accountability and transparency
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: BarChart3,
                                title: "Real-Time Scoring",
                                description: "Watch weighted scores calculate instantly as you rate. Section weights and letter grades update live.",
                                color: "from-blue-500/20 to-cyan-500/20"
                            },
                            {
                                icon: Shield,
                                title: "Evidence-Based",
                                description: "Smart input validation ensures every non-standard rating has documented proof. No shortcuts.",
                                color: "from-violet-500/20 to-purple-500/20"
                            },
                            {
                                icon: Users,
                                title: "Role-Based Flow",
                                description: "Staff self-assess, managers review side-by-side, directors approve. Clear accountability chain.",
                                color: "from-emerald-500/20 to-teal-500/20"
                            }
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="group relative p-8 rounded-2xl glass-panel hover-lift hover-glow cursor-default"
                            >
                                {/* Gradient Background */}
                                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                <div className="relative">
                                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                                        <feature.icon className="h-7 w-7 text-primary" />
                                    </div>
                                    <h4 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h4>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="relative border-t border-border/50">
                <div className="absolute inset-0 mesh-gradient opacity-50" />

                <div className="container relative py-20">
                    <div className="relative overflow-hidden rounded-3xl glass-panel-strong p-10 md:p-16">
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary rounded-2xl blur-xl opacity-50" />
                                    <div className="relative w-20 h-20 rounded-2xl bg-primary flex items-center justify-center glow-primary-strong">
                                        <FileCheck className="h-10 w-10 text-primary-foreground" />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                                        Ready to prove your performance?
                                    </h4>
                                    <p className="text-muted-foreground text-lg">
                                        Start your Q4 2024 self-assessment now
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="lg"
                                onClick={() => router.push(user ? "/dashboard" : "/auth")}
                                className="text-lg px-10 py-6 glow-primary-strong hover:scale-105 transition-all duration-300 shrink-0"
                            >
                                <Lock className="mr-2 h-5 w-5" />
                                {user ? "Open Dashboard" : "Get Started"}
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-border/50 py-10">
                <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">ProofPoint Performance OS</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span>Copyright by MAD Labs, Millennia World School</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
